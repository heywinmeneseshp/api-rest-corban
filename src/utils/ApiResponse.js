export class ApiResponse {
  static send(res, { statusCode = 200, message = '', data = null } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }
}

export default ApiResponse;
