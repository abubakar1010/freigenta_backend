import { Request, Response, NextFunction } from "express";
import { NewsService } from "../service/news.service";

const newsService = new NewsService();

export class NewsController {
  getAllNews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const articles = await newsService.getAllNews();
      res.status(200).json({
        success: true,
        data: articles.map((a) => ({
          id: a._id.toString(),
          title: a.title,
          content: a.content,
          imageUrl: a.imageUrl,
          createdAt: a.createdAt
        }))
      });
    } catch (error) {
    next(error);
  }
  };

  getNewsById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const article = await newsService.getNewsById(id);
      res.status(200).json({
        success: true,
        data: {
          id: article._id.toString(),
          title: article.title,
          content: article.content,
          imageUrl: article.imageUrl,
          createdAt: article.createdAt
        }
      });
    } catch (error) {
    next(error);
  }
  };

  createNews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { title, content, imageUrl } = req.body;
      const article = await newsService.createNews({ title, content, imageUrl });

      res.status(201).json({
        success: true,
        data: {
          id: article._id.toString(),
          title: article.title,
          content: article.content,
          imageUrl: article.imageUrl,
          createdAt: article.createdAt
        }
      });
    } catch (error) {
    next(error);
  }
  };

  updateNews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { title, content, imageUrl } = req.body;
      const article = await newsService.updateNews(id, { title, content, imageUrl });

      res.status(200).json({
        success: true,
        data: {
          id: article._id.toString(),
          title: article.title,
          content: article.content,
          imageUrl: article.imageUrl,
          createdAt: article.createdAt
        }
      });
    } catch (error) {
    next(error);
  }
  };

  deleteNews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      await newsService.deleteNews(id);

      res.status(200).json({
        success: true,
        message: "News article deleted successfully."
      });
    } catch (error) {
    next(error);
  }
  };
}
