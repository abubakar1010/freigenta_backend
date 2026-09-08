import { Career, ICareer } from "../models/careers.model";
import { AppError } from "../../../shared/utils/AppError";

export class CareerService {
  async getAllJobPostings(isAdmin: boolean = false): Promise<ICareer[]> {
    const filter: any = isAdmin ? {} : { status: "Visible" };
    return Career.find(filter).sort({ createdAt: -1 });
  }

  async getJobPostingById(id: string): Promise<ICareer> {
    const job = await Career.findById(id);
    if (!job) {
      throw new AppError("Job posting not found.", 404);
    }
    return job;
  }

  async createJobPosting(data: {
    title: string;
    description: string;
    location: string;
    workType: string;
    status?: "Visible" | "Hidden";
    formLink: string;
  }): Promise<ICareer> {
    if (
      !data.title ||
      !data.description ||
      !data.location ||
      !data.workType ||
      !data.formLink
    ) {
      throw new AppError("All job posting details are required.", 400);
    }

    const job = new Career(data);
    return job.save();
  }

  async updateJobPosting(
    id: string,
    data: {
      title: string;
      description: string;
      location: string;
      workType: string;
      status?: "Visible" | "Hidden";
      formLink: string;
    },
  ): Promise<ICareer> {
    const job = await Career.findById(id);
    if (!job) {
      throw new AppError("Job posting not found.", 404);
    }

    job.title = data.title;
    job.description = data.description;
    job.location = data.location;
    job.workType = data.workType;
    if (data.status) job.status = data.status;
    job.formLink = data.formLink;

    return job.save();
  }

  async toggleJobStatus(
    id: string,
    status?: "Visible" | "Hidden",
  ): Promise<ICareer> {
    const job = await Career.findById(id);
    if (!job) {
      throw new AppError("Job posting not found.", 404);
    }

    if (status) {
      job.status = status;
    } else {
      job.status = job.status === "Visible" ? "Hidden" : "Visible";
    }

    return job.save();
  }

  async deleteJobPosting(id: string): Promise<void> {
    const job = await Career.findById(id);
    if (!job) {
      throw new AppError("Job posting not found.", 404);
    }
    await Career.deleteOne({ _id: id });
  }
}
