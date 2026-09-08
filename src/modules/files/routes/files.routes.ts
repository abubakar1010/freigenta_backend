import { Router } from "express";
import {
  loadFile,
  authenticateIfPrivate,
  authorizeFile,
  serveFile,
} from "../controller/files.controller";

const router = Router();

/**
 * GET /api/files/<key>
 *
 * Keys contain slashes, so this is a wildcard route. Express 5 routes through
 * path-to-regexp v8, where a bare "*" is a parse error — the catch-all is
 * spelled "{*splat}".
 *
 * The order matters: the object has to be loaded before we can know whether it
 * is public, and therefore whether a token is required at all.
 */
router.get("/{*splat}", loadFile, authenticateIfPrivate, authorizeFile, serveFile);

export { router as fileRoutes };
