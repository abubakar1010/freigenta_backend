import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

export const validateRequest = (schema: ZodTypeAny) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors
            });
        }
    };
};
