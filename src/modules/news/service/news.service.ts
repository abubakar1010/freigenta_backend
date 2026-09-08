import { News, INews } from "../models/news.model";
import { AppError } from "../../../shared/utils/AppError";

export class NewsService {
  async getAllNews(): Promise<INews[]> {
    return News.find({}).sort({ createdAt: -1 });
  }

  async getNewsById(id: string): Promise<INews> {
    const article = await News.findById(id);
    if (!article) {
      throw new AppError("News article not found.", 404);
    }
    return article;
  }

  async createNews(data: { title: string; content: string; imageUrl?: string }): Promise<INews> {
    if (!data.title || !data.content) {
      throw new AppError("Title and content are required.", 400);
    }

    const article = new News(data);
    return article.save();
  }

  async updateNews(
    id: string,
    data: { title: string; content: string; imageUrl?: string }
  ): Promise<INews> {
    const article = await News.findById(id);
    if (!article) {
      throw new AppError("News article not found.", 404);
    }

    article.title = data.title;
    article.content = data.content;
    if (data.imageUrl) article.imageUrl = data.imageUrl;

    return article.save();
  }

  async deleteNews(id: string): Promise<void> {
    const article = await News.findById(id);
    if (!article) {
      throw new AppError("News article not found.", 404);
    }
    await News.deleteOne({ _id: id });
  }
}
