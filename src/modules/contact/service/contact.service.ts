import { Contact, IContact } from "../models/contact.model";
import { ContactInfo, IContactInfo } from "../models/contact-info.model";
import { AppError } from "../../../shared/utils/AppError";

export class ContactService {
  async getAllContacts(): Promise<IContact[]> {
    return Contact.find({}).sort({ createdAt: -1 });
  }

  async createContact(data: {
    fullName: string;
    email: string;
    companyName?: string;
    number?: string;
    message: string;
  }): Promise<IContact> {
    if (!data.fullName || !data.email || !data.message) {
      throw new AppError("Full name, email, and message are required fields.", 400);
    }

    const contact = new Contact(data);
    return contact.save();
  }

  async updateContactStatus(id: string, status: "Pending" | "Reviewed" | "Resolved"): Promise<IContact> {
    const contact = await Contact.findById(id);
    if (!contact) {
      throw new AppError("Contact message not found.", 404);
    }

    if (!["Pending", "Reviewed", "Resolved"].includes(status)) {
      throw new AppError("Invalid status value.", 400);
    }

    contact.status = status;
    return contact.save();
  }

  async deleteContact(id: string): Promise<void> {
    const contact = await Contact.findById(id);
    if (!contact) {
      throw new AppError("Contact message not found.", 404);
    }
    await Contact.deleteOne({ _id: id });
  }

  async getContactInfo(): Promise<IContactInfo> {
    let info = await ContactInfo.findOne({});
    if (!info) {
      // Auto seed blank default data on first request
      info = new ContactInfo({
        email: "",
        phone: "",
        businessHours: [],
        address: "",
        mapUrl: ""
      });
      await info.save();
    }
    return info;
  }

  async updateContactInfo(data: {
    email: string;
    phone: string;
    businessHours: string[];
    address: string;
    mapUrl: string;
  }): Promise<IContactInfo> {
    if (!data.email || !data.phone || !data.address || !data.mapUrl) {
      throw new AppError("Email, phone, address, and map URL are required.", 400);
    }

    let info = await ContactInfo.findOne({});
    if (!info) {
      info = new ContactInfo(data);
    } else {
      info.email = data.email;
      info.phone = data.phone;
      info.businessHours = data.businessHours;
      info.address = data.address;
      info.mapUrl = data.mapUrl;
    }
    return info.save();
  }
}
