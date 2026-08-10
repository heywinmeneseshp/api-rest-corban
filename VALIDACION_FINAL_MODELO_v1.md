# Validación Final del Modelo — Pronóstico de Cajas v1

**Estado**: Modelo v1 oficial, en producción.
**Última actualización de este documento**: 2026-08-07.
**Archivo central del modelo**: [`src/services/agricola/pronostico.service.js`](src/services/agricola/pronostico.service.js)
**Scripts de validación**: [`scripts/backtest-pronostico.mjs`](scripts/backtest-pronostico.mjs), [`scripts/generar-cuantiles-error.mjs`](scripts/generar-cuantiles-error.mjs)
**Tabla de cuantiles de error (generada, no manual)**: [`src/services/agricola/pronostico.errorQuantiles.json`](src/services/agricola/pronostico.errorQuantiles.json)

Este documento es la memoria técnica oficial del modelo de Pronóstico de
Cajas versión 1. Su propósito es que cualquier desarrollador — incluyendo
quien lo escribió — pueda entender dentro de uno o dos años, sin revisar
historial de commits ni conversaciones, **cómo funciona el modelo, por qué
quedó así, qué se probó y se descartó, y con qué evidencia**. No es un
resumen: cada afirmación de este documento está respaldada por un
experimento de backtest reproducible con los scripts citados.

---

## 1. Objetivo del modelo

### Qué problema resuelve

Corbana necesita proyectar, semana a semana, cuántas cajas de banano de
20kg va a producir — por finca individual o de forma agregada — para
planificación logística y comercial (transporte, empaque, ventas), sin
depender de una estimación manual hecha por un planificador a partir de su
experiencia.

### Qué pronostica

Para cada semana futura dentro del horizonte solicitado, y para cada
finca (o el agregado "GLOBAL" de todas las fincas del usuario si no se
selecciona ninguna en particular):

- **Racimos cosechados** (`racimosCosechados`): cuántos racimos se
  cosecharán esa semana.
- **Ratio cajas/racimo** (`ratio`): cuántas cajas de 20kg rinde en
  promedio un racimo cosechado.
- **Cajas de 20kg** (`cajas20kg`): el resultado final, `racimos × ratio`.
- **Aprovechamiento** (`aprovechamiento`): qué fracción de lo embolsado
  llega a convertirse en cosecha real (`(RECUSE + PROCESADO) / EMBOLSE`).
- **Intervalo de confianza al 90%** (`cajasCiLow`/`cajasCiHigh`): rango
  donde se espera, con 90% de probabilidad histórica, que caiga el valor
  real de cajas.
- **Nivel de confianza cualitativo** (`confianza`): `Real` / `Alta` /
  `Media` / `Baja`, derivado del ancho relativo del intervalo anterior.

### Horizonte objetivo

El validador de la API acepta hasta `semanas=53` (un año calendario
completo) — pero esto es un **límite técnico, no una garantía de
precisión**. El modelo está **validado empíricamente por backtest hasta 13
semanas** (ver sección 5). Más allá de ese punto, el intervalo de confianza
se extrapola matemáticamente (ensanchándolo con `sqrt(horizonte/13)`, la
tasa de crecimiento típica de un error acumulado tipo random-walk) pero
**nunca se ha medido contra datos reales** — ver sección 8.

### Variables de entrada

Todas provienen de tablas ya existentes en la base de datos operativa de
Corbana, sin ningún dato nuevo capturado para este modelo:

| Variable | Origen | Uso |
|---|---|---|
| Embolse semanal por finca | `racimo_movimientos` (`tipo = 'EMBOLSE'`), agrupado por `finca_id` y `semana_embolse_id` | Denominador de la tasa de cosecha por edad; también la variable proyectada hacia adelante para semanas futuras |
| Cosechado semanal por finca y edad | `racimo_movimientos` (`tipo IN ('PROCESADO', 'RECUSE')`), agrupado por `finca_id`, `semana_embolse_id`, `semana_registro_id` | Numerador de la tasa de cosecha por edad — nótese que **racimos cosechados = PROCESADO + RECUSE**, nunca solo PROCESADO (regla de negocio de Corbana) |
| Cajas de 20kg semanales por finca | `produccion_semanal` (`cajas_20kg`), agrupado por `finca_id` y `semana_id` | Numerador del ratio cajas/racimo |
| Calendario de semanas | `semanas` (`fecha_inicio`, `numero_semana`, `anio`) | Define qué semana es "real" (ya ocurrió) vs "proyectada", y la fase de calendario para el componente estacional |

### Variables calculadas

- `rate[edad]` (edad = 8 a 12 semanas): fracción histórica de un embolse
  que termina cosechada exactamente a esa edad.
- `ratioProyectado`: cajas/racimo proyectado, blend reciente+estacional.
- `embolseProyectadoNivel`: nivel de embolse semanal proyectado para
  semanas futuras sin dato real todavía (agregado en esta sesión — ver
  sección 3).
- `pctNoCosechado` / `aprovechamiento`: `1 − Σ_edad rate[edad]`.
- `cajasCiLow` / `cajasCiHigh`: intervalo de confianza construido desde la
  distribución empírica de errores históricos por horizonte.
- `cajasCiLowEstimador` / `cajasCiHighEstimador`: intervalo diagnóstico
  (bootstrap) que mide solo la incertidumbre del estimador — no se usa
  para `confianza`, solo para depuración interna.

---

## 2. Arquitectura final del modelo

Esta sección describe **exactamente el algoritmo que está en producción
hoy** en `computeForecast()` dentro de `pronostico.service.js`.

### 2.1 Unidad básica: el cohorte

Un **cohorte** es `(finca, semana de embolse)` — todos los racimos que se
embolsaron en una finca durante una semana específica. Un cohorte está
**cerrado** (`esCerrada()`) cuando ya pasó suficiente tiempo (`EDAD_MAX =
12` semanas) como para que, si algo del cohorte iba a cosecharse dentro de
la ventana de edades modeladas, ya habría ocurrido. Solo los cohortes
cerrados alimentan las tasas históricas — nunca se usa un cohorte todavía
"en tránsito" para calcular una tasa, porque subestimaría sistemáticamente
las edades tardías (todavía no tuvieron tiempo de cosecharse).

### 2.2 Curva de aprovechamiento por edad (`rate[edad]`)

Para cada edad `e` entre 8 y 12 semanas (ventana fija — política de la
empresa: no se corta antes de 8 semanas, y cortar después de 12 es
prácticamente inexistente en los datos, `~0.01%` de 4.36M racimos
analizados en 18 meses de historia, y se trata como ruido de captura, no
como señal):

```
rate[e] = (Σ cosechado a edad e, en cohortes cerrados)
          / (Σ embolse de esos mismos cohortes)
```

Esto se calcula **dos veces** — una con cohortes "recientes" (últimas
`RECIENTE_LOOKBACK = 32` semanas) y otra con cohortes "estacionales" (la
misma semana del calendario ±1, en hasta 3 años anteriores) — y se
**promedian 50/50** (ver 2.3).

**Corte duro de 5 cohortes** (`MIN_COHORTES_FINCA = 5`): si una finca (o
grupo) tiene menos de 5 cohortes cerrados combinando reciente+estacional,
su tasa propia no se usa — se reemplaza por completo por la tasa
**global** (calculada sobre todas las fincas del usuario, sin filtrar por
semana). Esto evita que una finca nueva o con muy poco historial arrastre
el pronóstico con una tasa estadísticamente inestable.

**Clamp de seguridad** (`TOPE_SUMA_RATE = 0.999`): matemáticamente,
`Σ_edad rate[edad]` no puede superar 1 (no se puede cosechar más de lo que
se embolsó). Si por ruido de datos la suma supera `0.999`, se reescala
proporcionalmente toda la curva para que sume exactamente `0.999`. Este
clamp se aplica **individualmente a reciente y a estacional, antes de
promediarlos** — no al resultado ya promediado (importante: promediar
primero y recortar después produce un sesgo distinto al recorte
individual, descubierto al construir el bootstrap — ver sección 4).

### 2.3 Blend reciente + estacional (50/50)

```
rawRate[edad] = tieneReciente && tieneEstacional
  ? (reciente.rawRate[edad] + estacional.rawRate[edad]) / 2
  : (el que exista de los dos, o 0 si ninguno)
```

Este mismo patrón de blend (reciente + estacional, promedio simple 50/50,
con degradación ordenada cuando falta una señal) se repite en **tres**
componentes del modelo: la curva de edad (`tasasBlend()`), el ratio
cajas/racimo (`ratiosRecientes`/`ratiosEstacionales`), y — agregado en esta
sesión — el nivel de embolse proyectado (`embolseRecientes`/
`embolseEstacionales`). Es la decisión de diseño central del modelo v1: se
intentó reemplazar por shrinkage empírico (Bühlmann-Straub) y no
sobrevivió el holdout (ver sección 3) — el 50/50 simple sigue siendo la
línea base confirmada.

### 2.4 Ratio cajas/racimo

Mismo patrón que 2.3, con una regla de respaldo adicional cuando hay poca
muestra reciente propia:

```
si hay reciente Y estacional:        ratio = (reciente + estacional) / 2
si solo hay estacional:               ratio = estacional
si reciente.length >= 3 semanas:      ratio = reciente
si 0 < reciente.length < 3 semanas:   ratio = blend ponderado con el
                                       ratio global (peso = reciente.length/3)
si no hay nada:                       ratio = ratio global
```

### 2.5 Proyección de embolse futuro (agregado en esta sesión, ver sección 4)

`racimosProyectados` para una semana de cosecha `S` se calcula como:

```
racimosProyectados(S) = Σ_edad embolseProyectado(S − edad + 1) × rate[edad] × scaleFactor
```

`embolseProyectado(E)` devuelve el embolse **real** si la semana `E` ya
ocurrió; si `E` es una semana futura (todavía no hay dato real, porque
está a menos de `EDAD_MAX − 1 = 11` semanas de distancia de una semana de
cosecha proyectada a más de 11 semanas de hoy), devuelve un **nivel
proyectado** de embolse — mismo blend reciente+estacional que el ratio
(2.4), pero sobre volumen de embolse en vez de sobre un ratio.

Esto es lo que hace que el pronóstico no colapse a cero después de ~11
semanas de horizonte — antes de este cambio, `embolseProyectado` no
existía y el modelo simplemente leía embolse real, que no existe para
semanas futuras.

### 2.6 Conversión final a cajas

```
cajas20kg = racimosProyectados × ratioProyectado
```

Para semanas **reales** que ya tienen datos de cosecha/cajas registrados,
no se usa el pronóstico — se muestra el dato real directamente
(`confianza = 'Real'`). El pronóstico solo se aplica a semanas sin dato
real todavía.

### 2.7 Intervalos de confianza (arquitectura final, no la primera versión)

**El mecanismo en producción hoy** construye el IC 90% desde la
**distribución empírica de errores históricos** observados en el backtest,
NO desde un bootstrap estadístico clásico (esa fue la primera versión,
reemplazada — ver sección 3 y 4):

```
horizonte h = número de semanas entre "hoy" y la semana proyectada
q = cuantiles[h]  // { lo, hi } — percentiles 5% y 95% del error relativo
                  // (actual − predicción) / predicción, medido en backtest
cajasCiLow  = cajas20kg × (1 + q.lo)
cajasCiHigh = cajas20kg × (1 + q.hi)
```

La tabla `q` por horizonte (1 a 13 semanas) vive en
`pronostico.errorQuantiles.json`, generada por
`scripts/generar-cuantiles-error.mjs` y validada contra un período de
holdout independiente (ver sección 5). Para horizontes más allá de 13
semanas (sin datos suficientes para medir), se extrapola ensanchando el
intervalo con `sqrt(horizonte/13)` — documentado como extrapolación no
validada, no como medición.

El **bootstrap clásico** (remuestreo de cohortes/semanas con reemplazo) se
conserva en el código como diagnóstico interno
(`cajasCiLowEstimador`/`cajasCiHighEstimador`) — mide solo la incertidumbre
del estimador, no el error real de pronóstico. No alimenta `confianza` ni
se muestra como el IC principal.

### 2.8 Holt-Winters (implementado, apagado por defecto)

Existe una implementación completa de suavizado exponencial con
estacionalidad (Holt-Winters aditivo, período 52 semanas) para el ratio,
detrás del flag `HW_EXPERIMENTO_ACTIVO` (env var
`PRONOSTICO_EXPERIMENTO_HW=1`, default `false`). **No está activo en
producción** — ver sección 3 y 6 para el porqué.

### 2.9 Agrupación GLOBAL vs por finca

Si el request no especifica `fincaUuids`, el modelo trata **todas las
fincas permitidas del usuario como un solo grupo agregado** ("GLOBAL") —
no como N pronósticos individuales sumados. Si se especifican una o más
fincas, cada una es su propio grupo con su propia tasa/ratio/IC.

---

## 3. Experimentos realizados

Todos los experimentos fueron evaluados con `scripts/backtest-pronostico.mjs`
(compara `computeForecast()` corrido con un `asOfDate` simulado en el
pasado contra el dato real ya conocido hoy) y, cuando el resultado en la
ventana de ajuste parecía prometedor, validados contra un **período de
holdout independiente nunca usado durante el ajuste** antes de aceptarse.

| # | Experimento | Objetivo | Resultado (ventana de ajuste) | Holdout / validación independiente | Decisión final | Motivo |
|---|---|---|---|---|---|---|
| 1 | **Exclusión de cohortes anómalos** | Eliminar del cálculo los cohortes donde `cosechado > embolsado` (dato imposible) | Empeoró MAPE/Bias en el backtest | — (descartado antes de necesitar holdout) | **Descartado** | Causa raíz investigada: los cohortes "imposibles" son ruido de atribución de semana (un movimiento mal asignado a la semana vecina) que **se autocompensa al agregar suficientes cohortes** — a nivel de año completo esas mismas fincas están sanas (ratio 0.93-0.98). Excluir el cohorte puntual bota señal real sin botar su compensación. |
| 2 | **Reescalado (clamp de seguridad agregado)** | Mecanismo de respaldo cuando `Σ rate[edad] > 0.999` | N/A — es el mecanismo que reemplazó a la exclusión | — | **Adoptado (producción)** | Corrige a nivel del agregado completo, no descarta cohortes puntuales — deja que el ruido se autocompense como ya lo hacía antes de cualquier intervención. |
| 3 | **Pooling** (sumar numerador+denominador de reciente+estacional antes de dividir, en vez de promediar dos tasas ya calculadas) | Ver si mejora sobre el blend 50/50 | Mejoró el Bias de forma consistente en un holdout de 2 puntos, pero empeoró el MAPE | **Validación cruzada temporal de 11 ventanas** (cada 12 semanas, 2024-01 a 2026-05): MAPE peor o igual en 3 de 4 horizontes (15.8→16.8%, 18.7→19.3%, 21.0→21.9%, 23.0→23.0%); Bias mixto | **Descartado** | Sin mejora robusta y consistente a través de múltiples ventanas independientes — la sospecha de que el holdout de 2 puntos era demasiado corto se confirmó al ampliar a 11 ventanas. |
| 4 | **Empirical Bayes / Shrinkage (Bühlmann-Straub)** | Reemplazar el corte duro de 5 cohortes por una fórmula de credibilidad que combina tasa propia y tasa global ponderada por evidencia | Mejora dramática en la ventana de ajuste (Bias a 4 semanas: -8.6% → -0.9%) | **Se revirtió** en un período histórico independiente (2023-06 a 2024-06): Bias a 4 semanas +5.3% → +9.8% (empeoró) | **Descartado** | La ventana de ajuste tenía sesgo negativo y el período independiente sesgo positivo — empujar hacia la tasa global solo amplificaba el sesgo de turno de cada ventana, no corregía nada estructural. Sobreajuste al período de ajuste. |
| 5 | **Curva global (β extremo, "casi 100% tasa global")** | Variante extrema de shrinkage, forzando casi toda la tasa hacia el promedio global | Mejora dramática en la ventana de ajuste | **Se revirtió** en el mismo holdout independiente que el experimento 4 | **Descartado** | Mismo mecanismo y misma falla que el shrinkage — confirma que el problema es conceptual (empujar hacia el global no corrige sesgo direccional), no de calibración del parámetro β. |
| 6 | **Holt-Winters** (suavizado exponencial con estacionalidad para el Ratio) | Capturar tendencia + estacionalidad explícitas en vez de un blend fijo 50/50 | Consistente pero mixto en la única ventana evaluable: MAPE y Bias mejoran claramente a 1-4 semanas (Bias ≈-13%→-5%); MAPE empeora fuerte a 8-12 semanas (≈16%→30% a 12 semanas) mientras el Bias sigue mejorando | Solo **una** ventana de evaluación disponible (2025-08 a 2026-05, 10 fechas, N=40/horizonte) — la historia operativa real solo empieza 2023-01-02 y Holt-Winters necesita 130 semanas para inicializar, dejando sin margen para una segunda ventana independiente | **Shelved** (no descartado, implementación completa detrás de flag apagado) | No alcanza el estándar de evidencia multi-ventana ya aplicado a toda otra decisión de este documento (los experimentos 3, 4 y 5 usaron 2-11 ventanas antes de decidir). Revisitar cuando exista una segunda ventana madura (~mediados de 2026). |
| 7 | **Bootstrap clásico** (IC no paramétrico por remuestreo de cohortes/semanas) | Construir el intervalo de confianza del 90% remuestreando con reemplazo | Matemáticamente correcto tras corregir un bug real de sesgo en muestra chica (ver sección 4), pero cobertura real medida en backtest: **6-10%** contra un objetivo de 90% | Confirmado en el backtest completo (no solo teóricamente) | **Reemplazado** como IC público; conservado como diagnóstico interno (`cajasCiLowEstimador`/`cajasCiHighEstimador`) | Mide solo la incertidumbre de ESTIMAR la tasa/ratio con una muestra distinta de cohortes — no incluye el sesgo estructural del modelo (~-8%, nunca resuelto) ni la variabilidad semana-a-semana genuina. Un IC centrado en un punto sesgado casi nunca cubre el valor real. |
| 8 | **Intervalos por distribución empírica de error histórico** | Construir el IC 90% desde los errores reales h-semanas-adelante ya observados en el backtest, no desde un modelo teórico de incertidumbre | Cobertura en holdout: 94-100% (medición inicial, antes de corregir el lookahead bias — ver experimento 9); 90-99% tras la corrección | Validado con **train/test split real**: cuantiles ajustados sobre 2024-07 a 2025-07-15, cobertura medida sobre 2025-08-01 a 2026-05-09 (nunca visto por el ajuste) | **Adoptado (producción)** | Es la única variante de IC que logró cobertura empírica cercana al objetivo de 90% — porque, por construcción, incluye TODAS las fuentes reales de error (parámetro + sesgo + variabilidad), no solo la incertidumbre del estimador. |
| 9 | **Corrección del lookahead bias** (fuga de futuro en la proyección de embolse) | Cerrar una fuga real descubierta al implementar la proyección de embolse futuro (ver sección 4) | El backtest reportaba MAPE=25.9%/Bias=-6.3% a 12 semanas; tras la corrección: **MAPE=47.1%/Bias=+17.7%** — el modelo es honestamente peor a 12 semanas de lo que se creía | N/A — es una corrección del EVALUADOR, no una variante del modelo a validar contra un holdout | **Adoptado (obligatorio)** | El backtest estaba midiendo mal, no el modelo funcionando mal. Corregir el evaluador tiene prioridad sobre seguir optimizando el modelo con una métrica que no refleja la realidad — ver sección 4 para el mecanismo exacto de la fuga. |

---

## 4. Hallazgos importantes

### 4.1 Anomalía María Margarita / Marbella (fincas 16 y 18)

Al investigar por qué la exclusión de cohortes anómalos (experimento #1)
empeoraba el backtest, se identificaron **65 cohortes** en las fincas 16
(MARÍA MARGARITA) y 18 (MARBELLA) donde el cosechado registrado supera el
embolsado registrado — matemáticamente imposible para un solo cohorte.
Verificado directamente contra la base de datos: estos cohortes se
concentran de forma recurrente en las semanas **~S32 a S39**, repitiéndose
en 2022, 2023 y 2024 (el caso más extremo: finca 16, S35-2023, 14.110
cosechados contra 7.124 embolsados — más del doble). A nivel de año
completo, sin embargo, esas mismas fincas tienen un ratio de aprovechamiento
sano (0.93-0.98) — la señal se autocompensa cuando se agregan suficientes
cohortes, consistente con un patrón de **atribución de semana incorrecta**
en la captura de datos (un movimiento registrado contra la semana de
embolse vecina en vez de la correcta) más que con un error estructural.
Esto es lo que llevó a mantener el clamp agregado (experimento #2) en vez
de la exclusión puntual (experimento #1).

### 4.2 Lookahead bias en el backtest (fuga de futuro no detectada por el guard anti-fuga)

El backtest tiene un guard explícito (`verificarSinFuga()`) diseñado para
evitar que el modelo "haga trampa" leyendo datos del futuro al simular un
`asOfDate` en el pasado. Ese guard audita **la fila de salida**: confirma
que ninguna fila marcada `real=true` apunte a una semana futura, y ninguna
fila `real=false` apunte a una semana ya pasada. Lo que **no** auditaba era
qué datos internos se usaron para *construir* esa fila.

Al agregar la proyección de embolse (sección 2.5, necesaria porque el
usuario notó que `racimosCosechados` caía a cero después de ~11 semanas de
horizonte), se descubrió que la función `embolseGrupo()` original no tenía
ningún chequeo de `asOfDate` — simplemente leía lo que hubiera en la base
de datos para esa semana de embolse. En una corrida de backtest real (hoy,
con toda la historia hasta 2026-08 disponible en la base de datos), una
semana de embolse "futura" respecto al `asOfDate` simulado **ya había
ocurrido de verdad** — el dato estaba ahí, y el modelo lo leía sin darse
cuenta de que en un despliegue real ese dato todavía no existiría. Esto
inflaba artificialmente la precisión del modelo a horizontes largos
(cualquier horizonte donde alguna de las 5 edades necesitara embolse de
una semana posterior al `asOfDate`) — el efecto era invisible en producción
real (donde `asOfDate = hoy` de verdad y el futuro genuinamente no existe
todavía) pero sistemático en cada backtest corrido durante todo este
proyecto.

### 4.3 Por qué el bootstrap clásico tenía solo 6-10% de cobertura

Un intervalo de confianza por bootstrap remuestrea la MUESTRA de datos
usada para estimar un parámetro (la tasa, el ratio) y mide cuánto varía
la estimación entre remuestreos. Eso responde "¿cuán preciso es mi
estimador con los datos que tengo?" — pero el error real de un pronóstico
tiene además otras dos fuentes que el bootstrap no captura: el **sesgo
estructural del modelo** (el modelo sub-proyecta consistentemente ~8% en
la ventana de ajuste principal, sin que ningún experimento validado lo
haya corregido — ver experimentos 3, 4 y 5) y la **variabilidad
semana-a-semana genuina** (clima, logística, eventos puntuales) que no
tiene nada que ver con la calidad del estimador. Un intervalo centrado en
un punto sistemáticamente sesgado, por muy preciso que sea el estimador,
casi nunca cubre el valor real observado — de ahí la cobertura de 6-10%
medida contra un objetivo de 90%.

### 4.4 Por qué se reemplazó por intervalos de error histórico

La distribución empírica de errores reales h-semanas-adelante — cuánto se
equivocó el modelo en el pasado, medido directamente, no inferido de un
modelo teórico — incluye por construcción TODAS las fuentes de error
(estimador + sesgo + variabilidad genuina), porque es literalmente la
diferencia entre lo que el modelo dijo y lo que pasó. No necesita
"entender" por qué el modelo se equivoca, solo necesita medir cuánto se
equivoca.

### 4.5 Qué aprendimos del holdout

Cada vez que un experimento parecía prometedor solo en la ventana de
ajuste, el holdout lo desmintió o lo puso en duda — shrinkage y curva
global (experimentos 4 y 5) directamente **revirtieron de signo** el Bias
al validarse en un período independiente. Sin el holdout, ambos se habrían
adoptado como mejoras reales.

### 4.6 Qué aprendimos del train/test

Para MAPE/Bias, un solo holdout de 2 puntos resultó insuficiente (caso
pooling, experimento 3) — hizo falta ampliar a una validación cruzada de
11 ventanas para tener confianza en la decisión. Para la cobertura del
intervalo de confianza, un solo split train/test resultó suficiente y
generalizó razonablemente bien (94-100% inicialmente, 90-99% tras corregir
el lookahead bias) — pero incluso así, la cobertura real varía
notablemente entre horizontes (90.5% a 98.8%), evidencia de que ni
siquiera una validación "correcta" produce un número único y estable; hay
que reportar el rango, no solo el promedio.

### 4.7 La historia operativa real es más corta que el calendario

El calendario de semanas (`semanas` en la base de datos) existe desde
2021-01-04, pero el seguimiento operativo real (`racimo_movimientos`,
`producción_semanal`) recién empieza el **2023-01-02**. Cualquier análisis
o modelo que asuma "historia completa" desde que existe el calendario cae
en una zona muerta de ~2 años sin datos — esto causó el bug de
inicialización de Holt-Winters (experimento 6) y debe tenerse en cuenta en
cualquier futuro análisis histórico sobre este dominio.

---

## 5. Métricas oficiales del modelo (línea base v1, post-corrección de lookahead bias)

Medidas con `scripts/backtest-pronostico.mjs`, rango 2024-07-01 a
~2026-05, sobre una muestra de 4 objetivos (GLOBAL + 3 fincas de volumen
chico/mediano/grande — LA VEGA, SANTANA, MARÍA MARGARITA), 25 fechas
`asOfDate` (cada 28 días). **Estas son las métricas oficiales de
referencia** — cualquier mejora futura debe compararse contra esta tabla.

| Horizonte | N | MAPE | Bias | Coverage IC 90% | Observaciones |
|---|---|---|---|---|---|
| 1 semana | 95 | 21.5% | -8.0% | 90.5% | Mayor MAPE relativo que 4/8 semanas — a 1 semana el modelo todavía no tiene "el dato real casi listo" como red de seguridad; ruido semanal puro. |
| 4 semanas | 96 | 18.2% | -8.6% | 92.7% | Mejor punto del modelo — suficiente horizonte para que el ruido de una sola semana se diluya, todavía dentro de la zona de embolse mayormente real. |
| 8 semanas | 97 | 18.8% | -8.5% | 93.8% | Prácticamente igual a 4 semanas — el modelo es notablemente estable en este rango. |
| 12 semanas | 94 | **47.1%** | **+17.7%** | 92.6% | Degradación fuerte y honesta (post-corrección del lookahead bias, ver experimento 9 y sección 4.2) — a este horizonte, TODAS las edades de la curva dependen de embolse proyectado, no real; el error se acumula. Bias cambia de signo (de sub-proyectar a sobre-proyectar) respecto a la medición pre-corrección. |

**Desglose por finca a 4 semanas** (misma corrida): GLOBAL 15.1% MAPE,
LA VEGA 15.4%, MARÍA MARGARITA 18.0%, SANTANA 25.3% (finca más volátil de
la muestra).

**Validación de cobertura independiente** (`scripts/generar-cuantiles-error.mjs`,
train 2024-07-01 a 2025-07-15, test/holdout 2025-08-01 a 2026-05-09, nunca
visto por el ajuste de los cuantiles): cobertura por horizonte entre
**90.5% y 98.8%** en los 12 horizontes evaluados (1 a 12 semanas), cobertura
global 95.7% sobre N=1004 observaciones — confirma que el sistema de IC
generaliza fuera de la ventana usada para calibrarlo, con un sesgo leve
hacia intervalos ligeramente más anchos de lo estrictamente necesario (el
lado seguro).

**Interpretación práctica**: el modelo es confiable de 1 a 8 semanas
(MAPE 18-22%, consistente). A 12 semanas, la precisión puntual cae
notablemente y el modelo tiende a sobre-proyectar — el intervalo de
confianza (mucho más ancho a ese horizonte, ver `pronostico.errorQuantiles.json`)
es la forma correcta de comunicar esa incertidumbre a un planificador, no
el número puntual solo.

---

## 6. Decisiones de diseño

Cada decisión de "mantener el status quo" está respaldada por evidencia de
backtest, no por default o pereza de no cambiar código:

- **Blend 50/50 (reciente + estacional)**: se mantiene porque las dos
  alternativas evaluadas para reemplazarlo (pooling, shrinkage —
  experimentos 3 y 4) no demostraron una mejora consistente en validación
  independiente. Sigue siendo la línea base confirmada por backtest.

- **Corte duro de 5 cohortes** (en vez de shrinkage empírico gradual): se
  mantiene por la misma razón — el mecanismo que lo reemplazaría
  (shrinkage, experimento 4) se revirtió en holdout independiente.

- **No usar pooling**: validación cruzada temporal de 11 ventanas mostró
  MAPE peor o igual en 3 de 4 horizontes frente al blend 50/50 — sin
  mejora robusta, se descartó definitivamente (no es un "por ahora", es un
  descarte confirmado con evidencia amplia).

- **No usar shrinkage empírico (Bühlmann-Straub)**: se revirtió al validar
  contra un período histórico independiente (Bias a 4 semanas +5.3%→+9.8%,
  empeorando) — la mejora en la ventana de ajuste era sobreajuste al sesgo
  específico de esa ventana, no una corrección estructural real.

- **No usar Holt-Winters en producción** (aunque está implementado y
  probado): solo existe UNA ventana de evaluación disponible dado que la
  historia operativa real recién cruza el umbral de 130 semanas necesario
  en 2025-08 — insuficiente para el estándar de evidencia multi-ventana ya
  aplicado a cada otra decisión de este documento. El patrón observado
  (mejora clara a 1-4 semanas, degradación fuerte a 8-12 semanas) es
  consistente pero no está confirmado fuera de una sola muestra.

- **Intervalos de confianza mediante distribución empírica de errores
  históricos** (no bootstrap clásico): el bootstrap, aunque matemáticamente
  correcto, medía solo 6-10% de cobertura real contra un objetivo de 90% —
  los intervalos empíricos, validados con train/test split independiente,
  logran 90-99% de cobertura.

---

## 7. Lecciones aprendidas

1. **No toda mejora estadísticamente fundamentada mejora el pronóstico.**
   Shrinkage empírico (Bühlmann-Straub) es una técnica sólida y bien
   establecida — y aun así no generalizó fuera de la ventana en la que se
   ajustó. Lo mismo con pooling y, parcialmente, con Holt-Winters a
   horizontes largos. La teoría estadística garantiza propiedades del
   estimador bajo supuestos; no garantiza que esos supuestos se cumplan en
   estos datos específicos.

2. **El backtest siempre tiene prioridad sobre la teoría.** Toda decisión
   de diseño en este documento está respaldada por un número de backtest,
   no por "debería funcionar porque la teoría lo dice".

3. **Una sola ventana de validación no es suficiente.** El caso pooling es
   el ejemplo más claro: pasó un holdout de 2 puntos, pero falló al
   ampliar a 11 ventanas de validación cruzada. Cualquier "mejora"
   validada con una sola comparación train/test debe tratarse como
   provisional, no como confirmada.

4. **El holdout evitó adoptar sobreajustes.** Shrinkage y curva global
   mostraban mejoras dramáticas en la ventana de ajuste que se habrían
   adoptado sin dudarlo de no haberse exigido una validación independiente
   — el holdout las revirtió a tiempo.

5. **Corregir el evaluador fue más importante que cambiar el algoritmo.**
   El lookahead bias en la proyección de embolse (hallazgo 4.2) estuvo
   inflando la precisión reportada a horizontes largos durante *todo* este
   proyecto, sin que ningún experimento lo detectara — porque todos se
   evaluaban con el mismo backtest, que tenía la fuga. Las comparaciones
   RELATIVAS entre variantes (shrinkage vs blend, HW vs blend) siguen
   siendo válidas porque la fuga afectaba a todas por igual, pero el nivel
   ABSOLUTO de precisión reportado durante el proyecto era optimista.
   Ninguna cantidad de ajuste al modelo iba a corregir eso — hacía falta
   arreglar el evaluador primero.

6. **Investigar una anomalía visible en la UI destapó un bug más
   profundo.** El hallazgo de que `racimosCosechados` caía a cero a partir
   de cierto horizonte no era solo un caso faltante (falta de proyección de
   embolse) — al arreglarlo, expuso el lookahead bias del punto 5. Vale la
   pena investigar comportamientos raros hasta la causa raíz, no solo
   hasta la primera explicación plausible.

---

## 8. Próximas líneas de investigación

**Nada de esta sección está implementado.** Se documenta como posibles
direcciones futuras, cada una sujeta al mismo criterio de aceptación de la
sección 9 antes de tocar el modelo en producción.

- **Mejorar la proyección de embolse.** La versión actual (sección 2.5) usa
  el mismo blend simple reciente+estacional que el ratio — podría
  beneficiarse de su propio modelo de tendencia (Holt-Winters propio, una
  vez exista suficiente historia validable) o de información externa sobre
  planes de siembra/floración.
- **Incorporar precipitación** como covariable de la tasa de cosecha o el
  ratio — el proyecto ya tiene un módulo de precipitación diaria
  (`/precipitacion-diaria`) cuyos datos podrían correlacionarse.
- **Incorporar temperatura.**
- **Incorporar radiación solar.**
- **Incorporar aplicaciones fitosanitarias** como covariable (posible señal
  de estrés o intervención que afecte el ritmo de cosecha).
- **Incorporar emisión foliar** como proxy de vigor de la planta y
  producción futura esperada.
- **Registrar pronóstico emitido vs. realidad, en producción** — hoy la
  validación es siempre retrospectiva vía backtest simulando el pasado;
  guardar cada pronóstico real emitido y compararlo contra lo que
  efectivamente ocurrió daría una segunda fuente de validación
  independiente del backtest, además de datos reales de producción para
  ampliar la muestra de validación de Holt-Winters y otros experimentos
  descartados por falta de ventanas.
- **Revalidar Holt-Winters** cuando exista una segunda ventana de
  evaluación independiente y madura (aprox. mediados de 2026, cuando la
  historia operativa real acumule otros ~130 semanas después de la
  primera ventana usada en el experimento 6).
- **Revisar shrinkage/pooling** con más historia real acumulada o una
  validación cruzada temporal más amplia que las 11 ventanas ya usadas —
  no se descarta que con más datos el resultado cambie, pero no hay
  evidencia hoy para revisitarlos antes de eso.
- **Investigar un mecanismo de amortiguación de tendencia ("damped
  trend")** para Holt-Winters, como posible explicación/solución a por qué
  degrada a horizontes largos (experimento 6) — no probado todavía.

---

## 9. Criterios para aceptar futuras mejoras

Ninguna mejora propuesta al modelo de Pronóstico de Cajas se incorporará a
producción a menos que demuestre, con evidencia reproducible, **todo** lo
siguiente:

1. **Mejora medible en `scripts/backtest-pronostico.mjs`** sobre la línea
   base oficial de la sección 5, en al menos MAPE o Bias, sin degradar
   significativamente el otro ni la cobertura del IC.
2. **Validación en un período de holdout independiente**, nunca usado para
   ajustar la mejora propuesta — un resultado que solo se ve bien en la
   ventana de ajuste no cuenta como evidencia (ver experimentos 4 y 5).
3. **Consistencia a través de múltiples ventanas**, no una sola
   comparación train/test — el número mínimo de ventanas depende de cuánta
   historia real esté disponible al momento, pero un solo holdout no es
   suficiente por precedente (ver experimento 3, revertido de 2 ventanas a
   11).
4. **La mejora relativa se sostiene, no solo el número absoluto** — dado
   que el nivel absoluto de las métricas puede cambiar por correcciones al
   evaluador (como el lookahead bias, experimento 9), toda comparación
   debe rehacerse contra la línea base oficial vigente al momento de la
   evaluación, no contra números históricos de este documento.

Si una mejora no cumple estos cuatro criterios, se documenta como
experimento descartado (o shelved, si la limitación es de datos
disponibles, no de la técnica en sí) siguiendo el mismo formato de la
sección 3 — nunca se adopta "porque parece razonable".

---

## 10. Conclusión

El modelo de Pronóstico de Cajas v1 se considera la versión oficial de
producción porque cada componente de su arquitectura — el blend 50/50, el
corte duro de 5 cohortes, el clamp de seguridad agregado, y el sistema de
intervalos de confianza por error histórico — sobrevivió un proceso
explícito de backtest y validación independiente, y las alternativas más
sofisticadas evaluadas (shrinkage empírico, pooling, curva global) fueron
descartadas específicamente porque **no** sobrevivieron ese mismo proceso,
pese a estar mejor fundamentadas teóricamente. Holt-Winters queda como
única pieza "en pausa" — no descartada, pero sin evidencia suficiente
todavía por una limitación real de datos (solo ~3.5 años de historia
operativa), no por un defecto de la técnica.

**Nivel de confianza actual**: alto para horizontes de 1 a 8 semanas (MAPE
18-22%, estable, cobertura de IC cercana al 90% objetivo en todo ese
rango). Notablemente más bajo a 12 semanas (MAPE 47%, con tendencia a
sobre-proyectar) — el modelo sigue siendo útil a ese horizonte porque el
intervalo de confianza comunica correctamente esa incertidumbre más
amplia, pero el número puntual solo debe tratarse con cautela más allá de
8 semanas.

**Limitaciones conocidas**:
- Solo ~3.5 años de historia operativa real (desde 2023-01), lo cual
  limita cuántas ventanas de validación independiente pueden construirse
  para cualquier técnica nueva — varias decisiones de este documento
  quedan sujetas a revisión cuando haya más historia disponible.
- El intervalo de confianza más allá de 13 semanas es una extrapolación
  matemática no validada contra datos reales.
- El modelo no incorpora ninguna covariable externa (clima, sanidad
  vegetal, plan de siembra) — toda la proyección viene exclusivamente del
  historial de embolse/cosecha/cajas de la propia finca.
- La proyección de embolse futuro (sección 2.5) es la pieza más nueva del
  modelo (agregada en esta misma sesión) y todavía no tiene el mismo nivel
  de escrutinio multi-ventana que el resto — su corrección honestizó las
  métricas a 12 semanas, pero en sí misma es un componente simple (blend
  50/50) con margen de mejora documentado en la sección 8.

**Metodología para futuras evoluciones**: cualquier cambio al modelo debe
seguir el ciclo ya establecido en este proyecto — proponer, medir con
backtest, validar en holdout independiente, y solo entonces adoptar — bajo
los criterios explícitos de la sección 9. Este documento debe actualizarse
cada vez que una decisión de diseño cambie, con la misma evidencia que
respaldó la decisión original.
