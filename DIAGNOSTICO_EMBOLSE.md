# Diagnóstico del histórico de Embolse

**Propósito**: entender cómo se comporta realmente el embolse (racimos
embolsados/semana) antes de tocar el algoritmo que lo proyecta —
identificado por el backtest por etapas como el componente que domina el
error del modelo de Pronóstico de Cajas (ver
[VALIDACION_FINAL_MODELO_v1.md](VALIDACION_FINAL_MODELO_v1.md), y el
backtest en [`scripts/backtest-pronostico.mjs`](scripts/backtest-pronostico.mjs):
MAPE de embolse 37-86% contra 13-26% del ratio y 21-45% de cosechados).

**Este documento no implementa nada.** Es exclusivamente diagnóstico. La
sección final propone modelos candidatos con base en la evidencia, para
decidir en una conversación aparte antes de escribir código.

**Reproducibilidad**: todo número de este documento sale de
[`scripts/analizar-embolse.mjs`](scripts/analizar-embolse.mjs)
(`DB_LOGGING=false node scripts/analizar-embolse.mjs`), que además escribe
`scripts/_analisis_embolse.json` con el detalle completo. Sin dependencias
nuevas — regresión lineal, ACF, MAD, correlación y η² están implementados a
mano en el script.

**Alcance de los datos**: serie semanal GLOBAL (suma de las 21 fincas) y
por finca, desde **S01-2023 hasta S30-2026** (186 semanas) — se excluyó
2021-2022 porque el seguimiento operativo real (`racimo_movimientos`) recién
empieza el 2023-01-02 (ver hallazgo 4.7 de `VALIDACION_FINAL_MODELO_v1.md`);
incluir esos años meterían ~2 años de ceros que no son "embolse bajo", son
"todavía no existía el sistema".

---

## 1. Tendencia

**No hay una tendencia lineal estable en todo el período — hay un cambio de
régimen claro entre 2023-2024 y 2025-2026.**

| Año | Semanas | Promedio semanal | Pendiente (racimos/semana) | R² |
|---|---|---|---|---|
| 2023 | 52 | 72.811 | **+1.531,1** | 0,641 |
| 2024 | 52 | 79.523 | **+1.610,8** | 0,618 |
| 2025 | 52 | 68.595 | +110,2 | 0,051 |
| 2026 (parcial, 30 sem) | 30 | 68.473 | +80,7 | 0,016 |

En 2023 y 2024, el embolse global crecía de forma fuerte y consistente
(~+1.550 racimos/semana adicionales cada semana, con R²>0,6 — una tendencia
real, no ruido). En 2025 esa tendencia prácticamente desaparece (pendiente
cae a +110/semana, R²=0,05 — estadísticamente casi plana) y el promedio
anual **cae** de 79.523 (2024) a 68.595 (2025). 2026 continúa en el mismo
nivel plano que 2025.

Ajustar una sola regresión lineal sobre las 186 semanas completas da una
pendiente casi nula (+27,6/semana, R²=0,004) — **ese número es engañoso**:
no es que "no hay tendencia", es que hay dos tendencias fuertes y opuestas
en magnitud que promediadas parecen "nada". Cualquier modelo que use un
único coeficiente de tendencia global sobre toda la historia va a
mal-representar tanto el período de crecimiento como el de meseta.

**Implicación directa para el modelo actual**: `embolseProyectadoNivel`
(el nivel plano que usa la proyección de embolse hoy) se calcula sobre una
ventana de las últimas 8 semanas reales — eso sí captura razonablemente el
régimen ACTUAL (2025-2026, plano), pero no tiene ningún mecanismo de
tendencia explícito, así que si el régimen vuelve a cambiar (por ejemplo, si
entra área nueva en producción), tardaría en reflejarlo.

---

## 2. Estacionalidad anual

**Señal estacional muy fuerte — la más fuerte de todo el diagnóstico.**

Quitando la tendencia (ver sección 1), la semana del año explica **η² =
0,65** de la varianza restante — es decir, dos tercios de lo que varía el
embolse semana a semana, una vez descontado el crecimiento/meseta general,
se explica solo por en qué época del año calendario está esa semana.

**Semanas más altas** (promedio de todos los años disponibles):
S51 (117.969), S50 (114.063), S48 (113.005), S47 (112.784), S49 (111.644) —
prácticamente todo diciembre.

**Semanas más bajas**: S13 (57.175), S11 (57.046), S14 (56.564), S9
(55.734), S10 (55.718) — prácticamente todo marzo. La diferencia entre pico
y valle es **más del doble** (118k vs 56k).

Agregar el índice estacional a la línea base reduce el desvío estándar del
residuo de 23.144 a 13.697 racimos/semana (una caída del 41% en desvío,
~65% en varianza — consistente con el η² de arriba). Es la variable
individual más predictiva de todas las analizadas en este diagnóstico.

**Estabilidad del patrón entre años** (correlación del perfil semana-del-año
entre años consecutivos):

| Años comparados | Semanas en común | Correlación |
|---|---|---|
| 2023 vs 2024 | 52 | **0,916** |
| 2024 vs 2025 | 52 | 0,433 |
| 2025 vs 2026 (parcial) | 30 | 0,585 |

El patrón estacional fue muy estable entre 2023 y 2024 (correlación 0,92 —
casi el mismo perfil calendario, solo con más volumen en 2024). Entre 2024
y 2025 la correlación cae fuertemente (0,43) — coincide exactamente con el
cambio de régimen de tendencia de la sección 1 y con la caída anómala de
fin de 2025 que aparece en la sección 7. La estacionalidad es real y fuerte,
pero **no es perfectamente estable año a año** — un modelo que asuma "la
misma curva todos los años" va a fallar en años con cambios estructurales
como 2025.

---

## 3. Variación semana a semana

Distribución del cambio porcentual semana a semana (`(semana_t −
semana_{t-1}) / semana_{t-1}`), sobre las 185 transiciones disponibles:

| Estadístico | Valor |
|---|---|
| Media | +0,7% |
| Desvío estándar | 11,3% |
| P5 | −8,8% |
| P25 | −3,0% |
| Mediana | −0,2% |
| P75 | +3,4% |
| P95 | +8,8% |

El embolse es razonablemente estable semana a semana en el caso típico
(mediana de cambio ≈ 0%, rango intercuartil ±3-3,4%), pero con una cola
ancha (P5/P95 de ±9%) — hay semanas de transición marcada, casi siempre
coincidiendo con el paso entre temporada alta y baja (ver sección 2).

---

## 4. Diferencias entre fincas

21 fincas, con comportamientos claramente distintos entre sí:

| Grupo | Fincas | Patrón |
|---|---|---|
| **Grandes y estables** | MARÍA MARGARITA (10,7% del total), LA CLARITA, LOLA, MACONDO, CALIFORNIA, FLORIDA, SAN FRANCISCO, CASAGRANDE, PALMA | CV 0,32-0,40, correlación con el global 0,86-0,96, pendiente propia levemente negativa (entre −1,8 y −9,1/semana) — consistente con el aplanamiento/leve declive de 2025-2026 visto en la sección 1. Estas 9 fincas concentran ~65% del embolse total. |
| **Medianas** | MARIA LUISA, VILLAGRANDE, LUCIA SUR, OASIS, LA VEGA | Correlación 0,70-0,92, comportamiento razonablemente alineado al global. |
| **Con historial corto o comportamiento idiosincrático** | PANTOJA (corr 0,29), SANTANA (corr 0,12, solo 115 semanas activas), BANAFE (corr −0,05, solo 60 semanas activas), LAS MARGARITAS (corr 0,40, 90 semanas activas), MARBELLA (corr 0,63, 149 semanas activas) | Baja o nula correlación con el patrón global — pendientes fuertemente positivas (SANTANA +26,4/semana, BANAFE +27,0/semana) consistentes con fincas todavía en fase de crecimiento/expansión de área, no siguiendo el ciclo estacional maduro del resto. CV más alto (0,50-0,57). |

**Implicación**: un modelo de embolse "one-size-fits-all" (mismos
parámetros para todas las fincas) va a funcionar razonablemente para las 9
fincas grandes y estables, pero mal para las fincas con historial corto o
en expansión — que además son las que más se benefician de tener AL MENOS
algún mecanismo de proyección, porque no tienen suficiente historia propia
para un promedio simple.

---

## 5. Autocorrelación

Sobre los residuos de tendencia (nivel crudo da prácticamente los mismos
números — el residuo apenas los cambia porque la tendencia global es casi
plana, ver sección 1):

| Lag (semanas) | ACF |
|---|---|
| 1 | 0,929 |
| 2 | 0,837 |
| 3 | 0,748 |
| 4 | 0,656 |
| 8 | 0,248 |
| 12 | −0,141 |
| 26 | −0,131 |
| **52** | **0,463** |

Dos hallazgos importantes:

1. **Decaimiento lento y suave de lag 1 a 4** (0,93 → 0,66) — el nivel de
   una semana predice muy bien el de la semana siguiente, y razonablemente
   bien hasta 3-4 semanas después. Confirma cuantitativamente lo que sugiere
   la sección 3 (cambios semana a semana moderados).
2. **Pico claro en lag 52** (0,463, muy por encima del ruido en lags
   vecinos como 26 o 12) — es una SEGUNDA confirmación, totalmente
   independiente del análisis por grupos de la sección 2, de que existe una
   estacionalidad anual real: el embolse de una semana se parece
   significativamente al de la misma semana un año antes, más allá de lo
   que explica la cercanía temporal.

---

## 6. Persistencia

La autocorrelación lag-1 (φ ≈ 0,929) es directamente interpretable como un
coeficiente AR(1): un "shock" o desviación respecto al nivel
tendencia+estacional esperado **tarda ~9,4 semanas en decaer a la mitad**.
Esto es una persistencia alta — el embolse no es un proceso que "olvide"
rápido una desviación reciente.

La autocorrelación de los **cambios** (no los niveles) es mucho más débil:
lag-1 = 0,124, lag-2 = −0,019, lag-3 = −0,011, lag-4 = 0,062 — hay un
indicio leve de momentum (un cambio positivo tiende a ir seguido de otro
cambio positivo, débilmente) pero no una reversión a la media marcada ni un
patrón fuerte más allá de una semana.

**Implicación directa**: la alta persistencia de NIVEL (no de cambios)
significa que el estado actual (dónde está el embolse ahora mismo) es
información valiosa que decae lentamente — un modelo que ignore el nivel
reciente y solo mire un promedio histórico amplio pierde una señal real que
dura varias semanas.

---

## 7. Eventos atípicos

Detectados como semanas cuyo residuo (tras quitar tendencia **y**
estacionalidad — ver nota metodológica abajo) supera ~4 MAD (desviación
absoluta mediana, medida robusta que no se deja arrastrar por los mismos
atípicos que busca detectar). 29 semanas de 186 quedaron marcadas — pero no
todas significan lo mismo:

**Nota metodológica importante**: los primeros dos grupos (2023 y 2024)
probablemente NO son anomalías reales — son un artefacto de usar una sola
tendencia lineal para los 4 años cuando la sección 1 ya mostró que 2023 y
2024 tenían su propia tendencia de crecimiento mucho más pronunciada que el
promedio global. Al ajustar una tendencia única y más suave, esos años
"sobrante" queda como residuo positivo. Esto no significa que la
estacionalidad esté mal medida (el η²=0,65 y la correlación 2023-vs-2024 de
0,92 siguen siendo sólidos) — significa que hay que tener cuidado al
interpretar residuos contra un modelo de tendencia demasiado simple.

**El hallazgo que sí parece real**: **S40 a S50 de 2025**, diez semanas
consecutivas, todas con residuo fuertemente NEGATIVO (entre −34.000 y
−44.000 racimos/semana, z-score robusto de hasta −7,0) — justo en lo que
debería ser la temporada alta del año (ver sección 2, S47-S51 son
normalmente las semanas más altas). Es un patrón sostenido de 10 semanas
seguidas, no un pico aislado — mucho menos probable que sea ruido o un
artefacto de medición. Coincide exactamente con la caída de correlación
estacional 2024-vs-2025 (0,43, sección 2) y con el fin de la tendencia de
crecimiento (sección 1). **Vale la pena investigar con el equipo agrícola
si hubo algún evento operativo conocido en ese período** (clima, plaga,
cambio de manejo, etc.) — este diagnóstico no tiene forma de saber la causa
solo con los datos de `racimo_movimientos`.

---

## 8. Relación con semana del año

Cubierto en detalle en la sección 2 — es, con diferencia, la relación más
fuerte encontrada en todo este diagnóstico (η²=0,65, confirmado
independientemente por el pico de ACF en lag 52). Un resumen adicional:
la razón pico/valle es de **2,1x** (118k en la semana más alta vs 56k en la
más baja) — no es una estacionalidad sutil, es la variable individual que
más mueve el embolse semana a semana después de remover el nivel general.

---

## 9. Relación con la edad promedio de la plantación

**Este dato no existe en la base de datos de Corbana.** Se revisaron los
modelos `Finca`, `Lote`, `Planta`, `CategoriaPlanta` y `LoteAreaProduccion`
— ninguno tiene un campo de fecha de siembra, renovación, o edad de
plantación/parcela. `LoteAreaProduccion` tiene una `fechaRegistro` (cuándo
se registró una medición de área), que no es lo mismo que edad de la
planta. Tampoco existe una tabla de "parcela".

**Implicación**: si la edad de la plantación es una hipótesis real para
explicar parte de la variación entre fincas (sección 4) o del cambio de
régimen (sección 1) — por ejemplo, área nueva entrando en producción en
2023-2024 y madurando/estabilizándose en 2025 —, esa hipótesis no se puede
confirmar ni descartar con los datos disponibles hoy. Sería necesario
capturar esta información por separado (fuera del alcance de este
diagnóstico) antes de poder usarla como variable del modelo.

**Dato relacionado, también investigado y también no disponible: embolse
por hectárea.** Normalizar el embolse por área de finca eliminaría gran
parte de la heterogeneidad entre fincas (sección 4 — parte de la baja
correlación de fincas chicas con el patrón global podría ser simplemente
tamaño, no comportamiento distinto) y podría explicar el cambio de régimen
de la sección 1 (¿fue área nueva entrando en producción en 2023-2024, no
más productividad?). El esquema para esto SÍ existe (`Lote.area` y una
tabla `LoteAreaProduccion` diseñada explícitamente para trackear área en el
tiempo, con join limpio contra `racimo_movimientos` por `finca_id`), pero
los datos no están capturados: `Lote.area` está en `NULL` en el 44% de los
320 lotes, y el resto tiene el mismo valor de relleno (`1.00`) en el
100% de los casos — no son mediciones reales. `LoteAreaProduccion` tiene
0 filas, completamente vacía. Es una captura de datos operativa pendiente,
no un problema de modelo — vale la pena plantearlo al equipo agrícola como
prioridad si se quiere usar esta variable en una futura versión.

**Cálculo previsto una vez exista el dato** (confirmado con el usuario):
hectáreas por finca = `SUM(Lote.area)` agrupado por `finca_id` (los lotes
ya están correctamente enlazados a su finca, `Lote.fincaId` es el mismo
entero que usa `racimo_movimientos.finca_id` — join limpio, sin necesidad
de tocar UUIDs). Con eso, `embolse_por_hectarea(finca, semana) =
embolse_semanal(finca, semana) / hectareas_totales(finca)` — el embolse ya
está disponible hoy, lo único pendiente es que `Lote.area` tenga mediciones
reales en vez del placeholder `1.00`.

---

## Resumen de hallazgos, ordenados por fuerza de la señal

| # | Señal | Fuerza | Estado |
|---|---|---|---|
| 1 | Estacionalidad anual (semana del año) | **Muy fuerte** (η²=0,65, pico ACF lag-52=0,46, razón pico/valle 2,1x) | Confirmada por 2 métodos independientes |
| 2 | Persistencia de nivel (autocorrelación de corto plazo) | **Fuerte** (φ≈0,93, decae a la mitad en ~9,4 semanas) | Confirmada |
| 3 | Cambio de régimen de tendencia (2023-2024 crecimiento vs 2025-2026 meseta) | **Fuerte, pero no es una tendencia continua** | Confirmada — una sola pendiente global es engañosa |
| 4 | Heterogeneidad entre fincas (grandes/estables vs chicas/en expansión) | **Moderada a fuerte** | Confirmada |
| 5 | Momentum en los cambios semana a semana | Débil (ACF cambios lag-1=0,12) | Presente pero menor |
| 6 | Evento negativo sostenido S40-S50 2025 | Localizado pero marcado (z hasta −7) | Requiere validación operativa, no explicable solo con los datos |
| 7 | Edad de plantación | — | Dato no disponible |

---

## Modelos candidatos para pronosticar embolse (propuesta, sin implementar)

Con base en la evidencia de arriba, cualquier modelo candidato debería, como
mínimo, capturar **estacionalidad anual** (señal #1, la más fuerte con
diferencia) y **persistencia de nivel de corto plazo** (señal #2) — el
modelo actual (promedio plano reciente+estacional, sin ningún componente de
tendencia ni de decaimiento explícito de shocks) no captura bien ninguna de
las dos de forma dinámica, lo cual es consistente con el MAPE de 37-86% que
motivó este diagnóstico.

Candidatos, de menor a mayor complejidad:

1. **Holt-Winters con tendencia amortiguada ("damped trend") por finca o
   grupo.** Ya existe una implementación de Holt-Winters en el proyecto
   (paso 5 del modelo de ratio, actualmente shelved) que se podría adaptar:
   captura nivel + tendencia + estacionalidad, exactamente los tres
   componentes más fuertes de este diagnóstico. La variante "amortiguada"
   (damped) es importante dado el hallazgo de la sección 1 — una tendencia
   sin amortiguar sobre-extrapolaría el crecimiento de 2023-2024 si
   volviera a aparecer, o sub-reaccionaría al aplanamiento de 2025-2026.
   Requeriría su propia validación multi-ventana (mismo estándar que el
   resto del proyecto) antes de adoptarse — y el mismo problema de
   historia corta que shelved Holt-Winters para el ratio podría repetirse
   aquí (aunque el umbral de datos necesario podría ser menor, dado que la
   señal estacional es más fuerte para embolse que para ratio).

2. **Modelo de regresión con índice estacional explícito + AR(1) sobre los
   residuos.** Más simple e interpretable que Holt-Winters completo:
   `embolse(t) = tendencia_local(t) + índice_estacional(semana_del_año) +
   φ·residuo(t-1)`, donde `tendencia_local` se estima sobre una ventana
   móvil corta (para adaptarse a cambios de régimen como el de 2025) en vez
   de sobre toda la historia. El φ≈0,93 medido en este diagnóstico da un
   punto de partida concreto para el término AR(1).

3. **Mismo enfoque reciente+estacional actual, pero con tendencia local de
   ventana corta agregada.** El cambio incremental más simple: mantener el
   blend reciente+estacional que ya existe, pero calcular la componente
   "reciente" como una tendencia (tipo tres últimas semanas con pendiente)
   en vez de un promedio plano — no resuelve la estacionalidad
   perfectamente pero corrige el problema más visible (nivel plano) sin
   introducir un modelo nuevo completo.

4. **Modelo por finca vs modelo agregado con factor de reparto.** La
   sección 4 sugiere que un modelo entrenado sobre el agregado GLOBAL y
   luego repartido proporcionalmente por finca podría funcionar bien para
   las 9 fincas grandes (correlación 0,86-0,96 con el global) pero mal para
   las fincas chicas/en expansión (correlación tan baja como −0,05 a
   0,40) — estas últimas necesitarían su propio tratamiento (quizás un
   modelo más simple tipo "última tendencia observada", dado que no tienen
   suficiente historia para estacionalidad confiable).

**Ninguno de estos candidatos debe adoptarse sin el mismo proceso ya
establecido en el proyecto**: implementar, medir con
`scripts/backtest-pronostico.mjs` (etapa "racimos embolsados"
específicamente), validar contra un holdout independiente, y solo entonces
decidir — exactamente el criterio de la sección 9 de
`VALIDACION_FINAL_MODELO_v1.md`.

---

## Resultado real: candidato 2 probado y descartado

Se implementó el candidato 2 (tendencia local de 12 semanas + índice
estacional explícito por semana del año + AR(1) con φ estimado sobre la
serie global, φ≈0,93) y se midió con el backtest por etapas. **Empeoró el
MAPE de embolse en los cuatro horizontes frente a la línea base** (el blend
plano reciente+estacional original) — no llegó a necesitar validación
holdout, porque ya perdía contra la línea base en la propia ventana de
ajuste:

| Horizonte | MAPE embolse (línea base → candidato 2) | Bias embolse (línea base → candidato 2) |
|---|---|---|
| 1 sem | 85,7% → 90,0% | +68,0% → +66,8% |
| 4 sem | 37,4% → **51,2%** | +17,0% → +14,8% |
| 8 sem | 50,9% → **79,6%** | +25,7% → **+33,3%** |
| 12 sem | 72,6% → **119,7%** | +46,0% → **+65,2%** |

Se propagó a cajas (MAPE a 12 semanas 47,1%→58,0%). **Descartado y
revertido** — el código quedó exactamente igual al de la línea base
(confirmado por backtest, idéntico byte-a-byte a la corrida anterior).

**Causa raíz probable**: la tendencia de ventana corta, extrapolada varios
horizontes hacia adelante, y el índice estacional completo se suman uno
sobre el otro sin ningún mecanismo de amortiguación — un smoke test antes
del backtest ya mostraba la señal de alerta (proyectaba 147k para la
semana pico de diciembre, contra un máximo histórico real de ~118k, sección
2). El Bias empeorando (más sobre-proyección, no menos) a 8 y 12 semanas
confirma que el problema es sobre-extrapolación, no una dirección de sesgo
equivocada.

**Dos hallazgos de datos útiles para cualquier futuro intento**, encontrados
depurando por qué los primeros resultados del candidato 2 eran absurdos
(órdenes de magnitud por debajo de lo real) antes de llegar al resultado
final de arriba:

1. La semana "actual" (la que contiene la fecha de referencia del pronóstico)
   suele contar como "real" en el sistema aunque todavía esté en curso — su
   embolse registrado hasta ese momento está incompleto, no es un valor
   final. El blend plano original ya lo evita (arranca en `startIdx - 1`,
   no en `startIdx`); cualquier modelo nuevo que ancle una tendencia o un
   término autorregresivo al "último dato real" debe aplicar el mismo
   recorte.
2. La semana real más reciente puede aparecer en cero por rezago de
   captura (el movimiento de EMBOLSE de esa semana todavía no se terminó de
   registrar), no porque de verdad no se embolsó nada — confirmado contra
   datos reales, donde la última semana mostraba 0 con la semana anterior
   en ~75.000. El blend plano original tolera esto bien porque promedia
   sobre una ventana (un cero entre 8 valores se diluye); un modelo que
   ancla su estado actual a un solo punto (como un término AR(1)) es mucho
   más frágil a este rezago y necesita su propio recorte de ceros finales.

**Próximo paso**: evaluar el candidato 3 (tendencia local agregada al blend
existente, sin reemplazar la estacionalidad por un índice completo) o una
variante amortiguada del candidato 2 — pendiente de decisión.
