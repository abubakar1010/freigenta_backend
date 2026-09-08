import { Request, Response, NextFunction } from "express";
import { CareerService } from "../service/careers.service";
import { verifyToken } from "../../../shared/utils/jwt.util";

const careerService = new CareerService();

export class CareerController {
  getAllJobPostings = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];
      let isAdmin = false;

      if (token) {
        try {
          const decoded = verifyToken(token);
          if (decoded && decoded.role === "ADMIN") {
            isAdmin = true;
          }
        } catch (err) { }
      }

      const jobs = await careerService.getAllJobPostings(isAdmin);
      res.status(200).json({
        success: true,
        data: jobs.map(j => ({
          id: j._id.toString(),
          title: j.title,
          description: j.description,
          location: j.location,
          workType: j.workType,
          status: j.status,
          formLink: j.formLink
        }))
      });
    } catch (error) {
    next(error);
  }
  };

  createJobPosting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { title, description, location, workType, status, formLink } = req.body;
      const job = await careerService.createJobPosting({
        title,
        description,
        location,
        workType,
        status,
        formLink
      });

      res.status(201).json({
        success: true,
        data: {
          id: job._id.toString(),
          title: job.title,
          description: job.description,
          location: job.location,
          workType: job.workType,
          status: job.status,
          formLink: job.formLink
        }
      });
    } catch (error) {
    next(error);
  }
  };

  updateJobPosting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { title, description, location, workType, status, formLink } = req.body;
      const job = await careerService.updateJobPosting(id, {
        title,
        description,
        location,
        workType,
        status,
        formLink
      });

      res.status(200).json({
        success: true,
        data: {
          id: job._id.toString(),
          title: job.title,
          description: job.description,
          location: job.location,
          workType: job.workType,
          status: job.status,
          formLink: job.formLink
        }
      });
    } catch (error) {
    next(error);
  }
  };

  toggleJobStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const job = await careerService.toggleJobStatus(id, status);

      res.status(200).json({
        success: true,
        data: {
          id: job._id.toString(),
          title: job.title,
          description: job.description,
          location: job.location,
          workType: job.workType,
          status: job.status,
          formLink: job.formLink
        }
      });
    } catch (error) {
    next(error);
  }
  };

  deleteJobPosting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      await careerService.deleteJobPosting(id);

      res.status(200).json({
        success: true,
        message: "Job posting deleted successfully."
      });
    } catch (error) {
    next(error);
  }
  };

  getJobPostingById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const job = await careerService.getJobPostingById(id);

      res.status(200).json({
        success: true,
        data: {
          id: job._id.toString(),
          title: job.title,
          description: job.description,
          location: job.location,
          workType: job.workType,
          status: job.status,
          formLink: job.formLink
        }
      });
    } catch (error) {
    next(error);
  }
  };
}

