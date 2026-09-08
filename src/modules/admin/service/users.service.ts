import { User } from "../../../shared/models/user.model";
import { Invoice } from "../../../shared/models/invoice.model";
import { AppError } from "../../../shared/utils/AppError";

export class AdminUsersService {
  async getUsers(page: number, limit: number, search: string, roleFilter: string) {
    const query: any = {};

    // 1. Role Filter
    if (roleFilter !== "All") {
      query.role = { $regex: new RegExp(`^${roleFilter}$`, "i") };
    }

    // 2. Text Search
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { emailAddress: { $regex: search, $options: "i" } },
        { "companyInfo.legalCompanyName": { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const dbUsers = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const users = dbUsers.map((u) => ({
      id: u._id.toString(),
      name: `${u.firstName} ${u.lastName}`,
      email: u.emailAddress,
      role: u.role.toLowerCase(),
      company: u.companyInfo?.legalCompanyName || "N/A",
      status: (u.isActive !== false) ? "Active" : "Inactive",
      lastLogin: u.updatedAt ? new Date(u.updatedAt).toLocaleDateString("en-GB") : "Never",
      avatarUrl: u.profilePictureUrl || "",
    }));

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleUserStatus(id: string) {
    const user = await User.findById(id);
    if (!user) throw new AppError("User not found", 404);

    user.isActive = user.isActive === false ? true : false;
    await user.save();

    return {
      id: user._id.toString(),
      status: user.isActive ? "Active" : "Inactive",
    };
  }

  async changeUserRole(id: string, role: string) {
    if (!role) throw new AppError("Role is required", 400);
    const validRoles = ["CUSTOMER", "ADMIN", "OPS", "COMPLIANCE", "TREASURY"];
    if (!validRoles.includes(role.toUpperCase())) {
      throw new AppError("Invalid role value", 400);
    }

    const user = await User.findOneAndUpdate(
      { _id: id },
      { $set: { role: role.toUpperCase() } },
      { new: true }
    );
    if (!user) throw new AppError("User not found", 404);

    return {
      id: user._id.toString(),
      role: user.role.toLowerCase(),
    };
  }

  async getUserById(id: string) {
    const user = await User.findById(id).select("-passwordHash");
    if (!user) throw new AppError("User not found", 404);

    const invoices = await Invoice.find({ customerId: user._id }).sort({ createdAt: -1 });

    return {
      user,
      invoices: invoices.map(inv => ({
        id: inv._id.toString(),
        invoiceNo: inv.invoiceNo,
        carrier: inv.carrier,
        amount: inv.amount,
        status: inv.status,
        createdAt: inv.createdAt
      }))
    };
  }

  async createStaffUser(data: {
    firstName: string;
    lastName: string;
    emailAddress: string;
    role: string;
    password?: string;
  }) {
    if (!data.firstName || !data.lastName || !data.emailAddress || !data.role) {
      throw new AppError("First name, last name, email address, and role are required", 400);
    }

    const existing = await User.findOne({ emailAddress: data.emailAddress.toLowerCase() });
    if (existing) {
      throw new AppError("Email address is already registered", 409);
    }

        // Generate a secure random password if not provided
    let password = data.password;
    if (!password) {
      const crypto = require("crypto");
      password = crypto.randomBytes(12).toString("hex") + "!";
    }
    const bcrypt = require("bcrypt");
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName: data.firstName,
      lastName: data.lastName,
      emailAddress: data.emailAddress.toLowerCase(),
      role: data.role.toUpperCase(),
      passwordHash,
      isPhoneVerified: true,
      phoneNumber: "N/A"
    });

    await newUser.save();

    return {
      id: newUser._id.toString(),
      name: `${newUser.firstName} ${newUser.lastName}`,
      email: newUser.emailAddress,
      role: newUser.role.toLowerCase(),
      company: "N/A",
      status: "Active",
      lastLogin: "Never",
      avatarUrl: ""
    };
  }
}


