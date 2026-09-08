import { User } from "../../../shared/models/user.model";

export class OpsKycService {
  /**
   * Translates internal DB verification states to client DTO status tags
   */
  private mapUserToKycRecord(u: any) {
    let status: "Under Review" | "Approved" | "Need info" | "Rejected" = "Under Review";
    if (u.identityVerificationStatus === "VERIFIED") {
      status = "Approved";
    } else if (u.identityVerificationStatus === "PENDING" || u.identityVerificationStatus === "MANUAL_REVIEW") {
      status = "Under Review";
    } else if (u.identityVerificationStatus === "REJECTED") {
      status = "Rejected";
    } else {
      status = "Need info";
    }

    const rawDate = u.createdAt;
    const formattedDate = rawDate
      ? new Date(rawDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        })
      : "N/A";

    return {
      id: `KYB-${u._id.toString().slice(-4).toUpperCase()}`,
      dbId: u._id.toString(),
      companyName: u.companyInfo?.legalCompanyName || `${u.firstName} ${u.lastName}`,
      industry: u.companyInfo?.industryType || "Logistics",
      businessType: u.companyInfo?.businessType || "Importer",
      status,
      uploadedDate: formattedDate
    };
  }

  async getKycReviews(params: { page: number; limit: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 10);

    // 1. Fetch only users who are CUSTOMERs (or have corporate documents uploaded)
    const query = { role: { $regex: /^customer$/i } };

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // 2. Map Mongoose results to DTO
    const records = users.map(u => this.mapUserToKycRecord(u));

    // 3. Count how many require immediate attention (Under Review state)
    const attentionCount = await User.countDocuments({
      role: { $regex: /^customer$/i },
      identityVerificationStatus: { $in: ["PENDING", "MANUAL_REVIEW"] }
    });

    return {
      records,
      attentionCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getKycDetails(id: string) {
    const u = await User.findById(id);
    if (!u) {
      throw new Error("Customer profile not found");
    }

    const companyName = u.companyInfo?.legalCompanyName || `${u.firstName} ${u.lastName}`;
    const logoUrl = u.profilePictureUrl || "https://images.unsplash.com/photo-1603582496739-163e790c6b1d?auto=format&fit=crop&w=150&h=150&q=80";

    const beneficialOwners = (u.companyDocuments?.beneficialOwners || []).map((o: any) => ({
      name: o.fullName,
      percentage: `${o.ownershipPercentage}%`
    }));

    // If empty beneficial owners, fallback to a mock one for presentation
    if (beneficialOwners.length === 0) {
      beneficialOwners.push({ name: `${u.firstName} ${u.lastName}`, percentage: "100%" });
    }

    const documents: any[] = [];
    const docs = u.companyDocuments;

    if (u.identityDocumentUrl) {
      documents.push({
        id: "doc-identity",
        title: "Identity Document",
        description: "Personal identification verification document (e.g. Passport, NIN, National ID).",
        fileName: u.identityDocumentUrl.split("/").pop() || "identity_document.pdf",
        iconType: "pdf-red",
        url: u.identityDocumentUrl
      });
    }

    if (u.proofOfAddressUrl) {
      documents.push({
        id: "doc-poa",
        title: "Proof of Address",
        description: "Proof of residential or operational address (e.g. utility bill).",
        fileName: u.proofOfAddressUrl.split("/").pop() || "proof_of_address.pdf",
        iconType: "pdf-red",
        url: u.proofOfAddressUrl
      });
    }

    if (docs?.certificateOfIncorporationUrl) {
      documents.push({
        id: "doc-coi",
        title: "Certificate Of Incorporation",
        description: "Official legal document proving incorporation of the corporate entity.",
        fileName: docs.certificateOfIncorporationUrl.split("/").pop() || "incorporation_certificate.pdf",
        iconType: "pdf-red",
        url: docs.certificateOfIncorporationUrl
      });
    }

    if (docs?.proofOfBusinessAddressUrl) {
      documents.push({
        id: "doc-pba",
        title: "Proof of Business Address",
        description: "Proof of the company's registered operational office address.",
        fileName: docs.proofOfBusinessAddressUrl.split("/").pop() || "proof_of_business_address.pdf",
        iconType: "pdf-red",
        url: docs.proofOfBusinessAddressUrl
      });
    }

    if (docs?.beneficialOwnershipDocUrl) {
      documents.push({
        id: "doc-bod",
        title: "Beneficial Ownership Document",
        description: "Declaration of ultimate beneficial owners holding equity shares.",
        fileName: docs.beneficialOwnershipDocUrl.split("/").pop() || "beneficial_ownership.pdf",
        iconType: "pdf-green",
        url: docs.beneficialOwnershipDocUrl
      });
    }

    return {
      id: `KYB-${u._id.toString().slice(-4).toUpperCase()}`,
      dbId: u._id.toString(),
      companyName,
      logoUrl,
      adminInfo: {
        fullName: `${u.firstName} ${u.lastName}`,
        jobTitle: u.jobTitle || "Administrator",
        email: u.emailAddress,
        phone1: u.phoneNumber,
        phone2: u.phoneNumber,
        emailVerification: u.isEmailVerified ? "Verified" : "Unverified"
      },
      beneficialOwners,
      companyInfo: {
        legalName: companyName,
        tradingName: u.companyInfo?.tradingName || companyName,
        taxId: u.companyInfo?.taxIdentificationNumber || "N/A",
        registrationNumber: u.companyInfo?.businessRegistrationNumber || "N/A",
        country: u.companyInfo?.countryOfIncorporation || u.country || "Nigeria",
        address: u.companyInfo?.businessAddress || "N/A",
        website: u.companyInfo?.website || "N/A",
        industryType: u.companyInfo?.industryType || "Logistics",
        businessType: u.companyInfo?.businessType || "Importer"
      },
      documents
    };
  }

  async updateKycStatus(id: string, action: "approve" | "reject" | "request-info") {
    const u = await User.findById(id);
    if (!u) {
      throw new Error("Customer profile not found");
    }

    if (action === "approve") {
      u.identityVerificationStatus = "VERIFIED";
      u.onboardingStep = "COMPLETED";
    } else if (action === "reject") {
      u.identityVerificationStatus = "REJECTED";
    } else if (action === "request-info") {
      u.identityVerificationStatus = "MANUAL_REVIEW";
    }

    await u.save();
    return this.getKycDetails(id);
  }
}
