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
import type { HotlistProspect } from "@/lib/types";
import { generateWithClaude } from "@/lib/api";
import { DEFAULT_HOTLIST_AUTOFILL_GEM } from "@/lib/gems";

interface ExtractedFields {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  linkedinUrl: string;
}

export function UploadContact({
  accountData,
  setAccountData,
  onComplete,
}: StepProps) {
  const engine = accountData.productEngine;
  const contact = engine.contact;

  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [title, setTitle] = useState(contact.title);
  const [company, setCompany] = useState(
    contact.company || accountData.companyName || "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(contact.linkedinUrl);
  const [image, setImage] = useState<string | null>(contact.image);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [error, setError] = useState("");
  const [addedToHotlist, setAddedToHotlist] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setExtractError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setExtractError("");
  };

  const autofillFromImage = async () => {
    if (!image) return;
    setExtracting(true);
    setExtractError("");
    try {
      const schema = {
        type: "OBJECT",
        properties: {
          firstName: { type: "STRING" },
          lastName: { type: "STRING" },
          title: { type: "STRING" },
          company: { type: "STRING" },
          linkedinUrl: { type: "STRING" },
        },
        required: ["firstName", "lastName", "title", "company", "linkedinUrl"],
      };
      const result = await generateWithClaude<ExtractedFields>({
        prompt:
          "Extract the visible name, title, company, and LinkedIn URL from this screenshot. Return empty string for any field you cannot read with confidence. Do NOT extract emails or phone numbers.",
        system: DEFAULT_HOTLIST_AUTOFILL_GEM,
        schema,
        image,
      });
      if (result.firstName) setFirstName(result.firstName);
      if (result.lastName) setLastName(result.lastName);
      if (result.title) setTitle(result.title);
      if (result.company) setCompany(result.company);
      if (result.linkedinUrl) setLinkedinUrl(result.linkedinUrl);
    } catch (err) {
      console.error("Product engine autofill error:", err);
      setExtractError(
        err instanceof Error
          ? err.message
          : "Failed to extract details from the screenshot.",
      );
    } finally {
      setExtracting(false);
    }
  };

  const persistContact = () => {
    setAccountData((prev) => ({
      ...prev,
      productEngine: {
        ...prev.productEngine,
        contact: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          title: title.trim(),
          company: company.trim(),
          linkedinUrl: linkedinUrl.trim(),
          image,
        },
      },
    }));
  };

  const handleSave = () => {
    if (!firstName.trim() && !lastName.trim() && !company.trim()) {
      setError("Provide at least a name or company before continuing.");
      return;
    }
    setError("");
    persistContact();
    onComplete();
  };

  const addToHotlist = () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ttl = title.trim();
    const co = company.trim();
    if (!fn && !ln && !co) {
      setError(
        "Provide at least a name or company before adding to the hotlist.",
      );
      return;
    }
    setError("");
    persistContact();
    const prospect: HotlistProspect = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      firstName: fn,
      lastName: ln,
      title: ttl,
      company: co || accountData.companyName || "",
      linkedinUrl: linkedinUrl.trim(),
      priority: "high",
      notes: `Added from Product Engine - Upload Contact (${engine.selectedProduct || "no product"}).`,
      dateAdded: new Date().toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      }),
      messages: [],
      image,
    };
    setAccountData((prev) => ({
      ...prev,
      hotlist: [prospect, ...(prev.hotlist || [])],
    }));
    setAddedToHotlist(true);
    setTimeout(() => setAddedToHotlist(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Optional: upload a LinkedIn screenshot to autofill the contact you want
        to message about <strong>{engine.selectedProduct || "this product"}</strong>.
        You can also fill the fields manually.
      </p>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            LinkedIn Screenshot{" "}
            <span className="text-slate-400 font-normal normal-case">
              (optional)
            </span>
          </label>
          {image && (
            <button
              onClick={autofillFromImage}
              disabled={extracting}
              className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              {extracting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              {extracting ? "Extracting..." : "Autofill from image"}
            </button>
          )}
        </div>
        <div className="border-2 border-dashed border-purple-200 rounded-lg h-24 flex items-center justify-center bg-white relative overflow-hidden shadow-sm hover:bg-purple-50/30 transition-colors">
          {image ? (
            <div className="w-full h-full relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt="Contact screenshot"
                className="w-full h-full object-cover opacity-70"
              />
              <button
                onClick={removeImage}
                className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-red-600 bg-white/80 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
              >
                Remove image
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                id="product-engine-image-upload"
                className="hidden"
                onChange={handleImageUpload}
              />
              <label
                htmlFor="product-engine-image-upload"
                className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-purple-500 hover:text-purple-700 transition-colors"
              >
                <ImageIcon className="w-5 h-5 mb-1 opacity-80" />
                <span className="text-[11px] font-medium">
                  Click to upload LinkedIn screenshot
                </span>
              </label>
            </>
          )}
        </div>
        {extractError && (
          <p className="text-red-500 text-xs mt-2">{extractError}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            First Name
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Last Name
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Title
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Company
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            LinkedIn URL
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm text-gray-800"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="pt-2 flex justify-end items-center gap-3 flex-wrap">
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
          className="text-purple-700 hover:text-purple-900 font-medium text-sm flex items-center gap-1"
        >
          Save &amp; Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
