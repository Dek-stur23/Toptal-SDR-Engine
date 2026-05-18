"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Flame,
  Image as ImageIcon,
  Loader2,
  Wand2,
} from "lucide-react";
import type { StepProps } from "@/components/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_SOFTWARE_CONTACT_EXTRACT_GEM } from "@/lib/gems";
import { createProspect, prependProspects } from "@/lib/hotlist";

interface ExtractedFields {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
}

export function UploadContact({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.softwareEngine;
  const contact = engine.contact;
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [title, setTitle] = useState(contact.title);
  const [company, setCompany] = useState(
    contact.company || accountData.companyName || "",
  );
  const [liText, setLiText] = useState(contact.liText);
  const [liImage, setLiImage] = useState<string | null>(contact.liImage);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [addedToHotlist, setAddedToHotlist] = useState(false);

  const addToHotlist = () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ttl = title.trim();
    const co = company.trim();
    if (!fn && !ln && !co) {
      setError("Provide at least a name or company before adding to the hotlist.");
      return;
    }
    const prospect = createProspect({
      firstName: fn,
      lastName: ln,
      title: ttl,
      company: co || accountData.companyName || "",
      priority: "high",
      notes: "Added from Software Engine - Upload Contact.",
      image: liImage,
    });
    setAccountData((prev) => ({
      ...prev,
      hotlist: prependProspects(prev.hotlist ?? [], [prospect]),
    }));
    setAddedToHotlist(true);
    setTimeout(() => setAddedToHotlist(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setLiImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!liText.trim() && !liImage) {
      setError("Paste LinkedIn text or upload a screenshot first.");
      return;
    }
    setExtracting(true);
    setError("");
    try {
      const prompt = `Extract the contact details from the following LinkedIn profile data.\nText Data: ${liText || "None. See attached image."}`;
      const schema = {
        type: "OBJECT",
        properties: {
          firstName: { type: "STRING" },
          lastName: { type: "STRING" },
          title: { type: "STRING" },
          company: { type: "STRING" },
        },
        required: ["firstName", "lastName", "title", "company"],
      };
      const result = await generateWithClaude<ExtractedFields>({
        prompt,
        system: DEFAULT_SOFTWARE_CONTACT_EXTRACT_GEM,
        schema,
        image: liImage,
      });
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.title) setTitle(result.title);
      if (result.company) setCompany(result.company);
    } catch (err) {
      console.error("Contact extract error:", err);
      setError(err instanceof Error ? err.message : "Failed to extract contact details.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim() || !title.trim() || !company.trim()) {
      setError("Provide First Name, Last Name, Title, and Company.");
      return;
    }
    setAccountData((prev) => ({
      ...prev,
      softwareEngine: {
        ...prev.softwareEngine,
        contact: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          title: title.trim(),
          company: company.trim(),
          liText,
          liImage,
        },
      },
    }));
    onComplete();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Upload a LinkedIn screenshot or paste profile text. Autofill name,
        title, and company.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-blue-100 pb-2">
            <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              Contact Details
            </h5>
            {(liText.trim() || liImage) && (
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {extracting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wand2 className="w-3 h-3" />
                )}
                {extracting ? "Extracting..." : "Autofill"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
              placeholder="First Name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
              placeholder="Last Name *"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 shadow-sm"
            placeholder="Company *"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wider border-b border-blue-100 pb-2">
            LinkedIn Context
          </h5>
          <textarea
            className="w-full h-20 p-3 text-sm text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar shadow-sm"
            placeholder="Paste their About section, experience, or recent posts..."
            value={liText}
            onChange={(e) => setLiText(e.target.value)}
          />
          <div className="border-2 border-dashed border-blue-200 rounded-lg h-20 flex items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-blue-50/50 transition-colors">
            {liImage ? (
              <div className="w-full h-full relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={liImage}
                  alt="LinkedIn Profile"
                  className="w-full h-full object-cover opacity-60"
                />
                <button
                  onClick={() => setLiImage(null)}
                  className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-red-600 bg-white/80 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                >
                  Remove Image
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  id="software-engine-image-upload"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <label
                  htmlFor="software-engine-image-upload"
                  className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-blue-500 hover:text-blue-700 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                  <span className="text-[11px] font-medium">
                    Click to upload screenshot
                  </span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="pt-2 flex justify-end items-center gap-3">
        <button
          onClick={addToHotlist}
          className="text-orange-700 hover:text-orange-900 font-medium text-sm flex items-center gap-1"
        >
          {addedToHotlist ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> Added to Hotlist
            </>
          ) : (
            <>
              <Flame className="w-4 h-4" /> Add to Hotlist
            </>
          )}
        </button>
        <button
          onClick={handleSave}
          className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
        >
          Save &amp; Continue to MessageCrafter{" "}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
