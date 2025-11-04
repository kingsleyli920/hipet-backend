import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export default function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    const status = err.statusCode || 500;
    const isValidation = err.validation || err.code === 'FST_ERR_VALIDATION';
    
    const payload = {
      success: false,
      error: {
        message: isValidation ? 'Validation failed' : (err.message || 'Internal Server Error'),
        code: err.code || undefined,
        details: isValidation ? err.validation : undefined
      }
    };
    
    if (status >= 500) {
      app.log.error({ err }, 'Unhandled error');
    }
    
    reply.code(status).send(payload);
  });
}

