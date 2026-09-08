import { Request, Response, NextFunction } from "express";
import { ContactService } from "../service/contact.service";

const contactService = new ContactService();

export class ContactController {
  getAllContacts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const messages = await contactService.getAllContacts();
      res.status(200).json({
        success: true,
        data: messages.map((m) => ({
          id: m._id.toString(),
          fullName: m.fullName,
          email: m.email,
          companyName: m.companyName,
          number: m.number,
          message: m.message,
          status: m.status,
          createdAt: m.createdAt
        }))
      });
    } catch (error) {
    next(error);
  }
  };

  createContact = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { fullName, email, companyName, number, message } = req.body;
      const contact = await contactService.createContact({
        fullName,
        email,
        companyName,
        number,
        message
      });

      res.status(201).json({
        success: true,
        data: {
          id: contact._id.toString(),
          fullName: contact.fullName,
          email: contact.email,
          companyName: contact.companyName,
          number: contact.number,
          message: contact.message,
          status: contact.status,
          createdAt: contact.createdAt
        }
      });
    } catch (error) {
    next(error);
  }
  };

  updateContactStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const contact = await contactService.updateContactStatus(id, status);

      res.status(200).json({
        success: true,
        data: {
          id: contact._id.toString(),
          fullName: contact.fullName,
          email: contact.email,
          companyName: contact.companyName,
          number: contact.number,
          message: contact.message,
          status: contact.status,
          createdAt: contact.createdAt
        }
      });
    } catch (error) {
    next(error);
  }
  };

  deleteContact = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      await contactService.deleteContact(id);

      res.status(200).json({
        success: true,
        message: "Contact message deleted successfully."
      });
    } catch (error) {
    next(error);
  }
  };

  getContactInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const info = await contactService.getContactInfo();
      res.status(200).json({
        success: true,
        data: info
      });
    } catch (error) {
    next(error);
  }
  };

  updateContactInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, phone, businessHours, address, mapUrl } = req.body;
      const info = await contactService.updateContactInfo({
        email,
        phone,
        businessHours,
        address,
        mapUrl
      });
      res.status(200).json({
        success: true,
        data: info
      });
    } catch (error) {
    next(error);
  }
  };
}
