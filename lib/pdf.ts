"use client";

import type { AccountData, IcpIntelResult } from "./types";

function escapeHtml(unsafe: unknown): string {
  if (typeof unsafe !== "string") return String(unsafe ?? "");
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const safeHref = (link: string): string => {
  const trimmed = link.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

export function exportAccountToPdf(data: AccountData): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export the PDF.");
    return;
  }

  const sections: string[] = [];

  if (data.aiResearch) {
    const r = data.aiResearch;
    sections.push(`
      <h2>Step 2: Account Overview</h2>
      <div class="card">
        <h3>Corporate Structure</h3><p>${escapeHtml(r.corporateStructure)}</p>
        <h3>Recent News &amp; Events</h3><p>${escapeHtml(r.recentNews)}</p>
        <h3>Priorities &amp; Challenges</h3><p>${escapeHtml(r.prioritiesAndChallenges)}</p>
        <h3>12-Month Roadmap</h3><p>${escapeHtml(r.roadmap)}</p>
        <h3>Pursuit Strategies</h3><p>${escapeHtml(r.pursuitStrategies)}</p>
      </div>
      <div class="card">
        <h3>Key Buyers Organization</h3>
        ${r.keyBuyers
          .map(
            (dept) => `
          <h4>${escapeHtml(dept.department)}</h4>
          <ul>${dept.roles.map((role) => `<li>${escapeHtml(role)}</li>`).join("")}</ul>
        `,
          )
          .join("")}
      </div>
    `);
  }

  if (data.initiativeResearch) {
    const i = data.initiativeResearch;
    sections.push(`
      <h2>Step 3: Account Initiative &amp; Challenges</h2>
      ${i.initiatives
        .map(
          (init) => `
        <div class="card">
          <span class="badge initiative">INITIATIVE</span>
          <h3>${escapeHtml(init.name)}</h3>
          <p class="text-sm"><strong>Primary:</strong> ${escapeHtml(init.primarySource)} | <strong>Supporting:</strong> ${escapeHtml(init.supportingEvidence)}</p>
          <p>${escapeHtml(init.analysis)}</p>
          <p class="italic text-sm"><strong>Toptal Hook:</strong> "${escapeHtml(init.toptalHook)}"</p>
        </div>`,
        )
        .join("")}
      ${i.challenges
        .map(
          (chal) => `
        <div class="card">
          <span class="badge challenge">CHALLENGE</span>
          <h3>${escapeHtml(chal.name)}</h3>
          <p class="text-sm"><strong>Primary:</strong> ${escapeHtml(chal.primarySource)} | <strong>Supporting:</strong> ${escapeHtml(chal.supportingEvidence)}</p>
          <p>${escapeHtml(chal.analysis)}</p>
          <p class="italic text-sm"><strong>Toptal Hook:</strong> "${escapeHtml(chal.toptalHook)}"</p>
        </div>`,
        )
        .join("")}
    `);
  }

  if (data.productMap && data.productMap.entries.length > 0) {
    const categoryLabels: Record<string, string> = {
      "customer-facing": "Customer-Facing",
      platform: "Platform & Developer",
      "recent-launch": "Recent Launches",
      "in-development": "In Development",
    };
    const order = [
      "recent-launch",
      "in-development",
      "customer-facing",
      "platform",
    ];
    const grouped: Record<string, typeof data.productMap.entries> = {};
    for (const e of data.productMap.entries) {
      (grouped[e.category] ??= []).push(e);
    }
    sections.push(`
      <h2>Step 4: Product &amp; Project Map</h2>
      ${data.productMap.metadata ? `<p class="text-sm">${escapeHtml(data.productMap.metadata)}</p>` : ""}
      ${order
        .filter((c) => grouped[c] && grouped[c].length > 0)
        .map(
          (c) => `
            <div class="card">
              <h3>${escapeHtml(categoryLabels[c] ?? c)}</h3>
              <ul>${grouped[c]
                .map(
                  (e) => `<li>
                    <strong>${escapeHtml(e.name)}</strong>
                    <span class="badge">${escapeHtml(e.status)}</span>
                    <p>${escapeHtml(e.description)}</p>
                    ${e.evidenceSummary ? `<p class="text-sm"><em>Evidence:</em> ${escapeHtml(e.evidenceSummary)}</p>` : ""}
                    ${e.primarySource && /^https?:\/\//i.test(e.primarySource) ? `<p class="text-sm"><a href="${escapeHtml(e.primarySource)}">Source</a></p>` : ""}
                  </li>`,
                )
                .join("")}</ul>
            </div>`,
        )
        .join("")}
    `);
  }

  if (data.procurementStrategy) {
    const s = data.procurementStrategy;
    sections.push(`
      <h2>Step 5: Procurement Insights</h2>
      <div class="card">
        <h3>Structure &amp; Playbook</h3>
        <p><strong>Org Insights:</strong> ${escapeHtml(s.orgStructureInsights)}</p>
        <p><strong>Tech Prediction:</strong> ${escapeHtml(s.techStackPrediction)}</p>
        <p><strong>Recommended Play:</strong> ${escapeHtml(s.entryStrategy)}</p>
      </div>
      <div class="card">
        <h3>Top Targets</h3>
        <ul>${s.topTargets.map((t) => `<li><strong>${escapeHtml(t.name)}</strong> (${escapeHtml(t.title)}) - <span class="badge">${escapeHtml(t.personaBucket)}</span><br/><span class="text-sm">${escapeHtml(t.reason)}</span></li>`).join("")}</ul>
      </div>
      <div class="card">
        <h3>Draft Outreach Strategy</h3>
        <p><strong>The Hook:</strong> ${escapeHtml(s.theHook)}</p>
        <h4>F-Letter Script Outline</h4>
        <p class="text-sm">
          <em>Trigger:</em> ${escapeHtml(s.draftFLetter.trigger)}<br/>
          <em>Connection:</em> ${escapeHtml(s.draftFLetter.connection)}<br/>
          <em>CTA:</em> ${escapeHtml(s.draftFLetter.cta)}
        </p>
      </div>
    `);
  }

  if (data.procurementCadence) {
    const c = data.procurementCadence;
    sections.push(`
      <h2>Procurement Email Cadence</h2>
      ${[c.email1, c.email2, c.email3]
        .map(
          (email, idx) => `
        <div class="card">
          <h3>Email ${idx + 1}</h3>
          <p><strong>Subject:</strong> ${escapeHtml(email.subject)}</p>
          <pre class="email-body">${escapeHtml(email.body)}</pre>
        </div>`,
        )
        .join("")}
    `);
  }

  if (data.accountContextNotes) {
    sections.push(`
      <h2>Step 6: Account Context</h2>
      <div class="card"><p style="white-space: pre-wrap;">${escapeHtml(data.accountContextNotes)}</p></div>
    `);
  }

  if (data.previousContacts?.length) {
    sections.push(`
      <h2>Step 7: Previous Contacts</h2>
      <div class="card">
        <ul>
          ${data.previousContacts
            .map(
              (c) => `<li><strong>${escapeHtml(c.name)}</strong> - ${escapeHtml(c.title)} ${c.salesforceLink ? `(<a href="${escapeHtml(safeHref(c.salesforceLink))}" target="_blank">Salesforce</a>)` : ""}<br/><span class="text-sm">${escapeHtml(c.notes)}</span></li>`,
            )
            .join("")}
        </ul>
      </div>
    `);
  }

  if (data.teamLinks?.length) {
    sections.push(`
      <h2>Step 8: Team Link Search</h2>
      <div class="card">
        <ul>
          ${data.teamLinks
            .map(
              (link) => `<li><strong>${escapeHtml(link.name)}</strong> <span class="badge">${escapeHtml(link.personType)}</span> - ${escapeHtml(link.connection)}<br/><span class="text-sm">${escapeHtml(link.notes)}</span></li>`,
            )
            .join("")}
        </ul>
      </div>
    `);
  }

  if (data.missions?.length) {
    sections.push(`
      <h2>Step 9: Mission Builder</h2>
      <div class="card">
        <ul>
          ${data.missions
            .map(
              (m) => `
            <li style="margin-bottom: 16px;">
              <strong>${escapeHtml(m.name)}</strong> <span class="badge">${escapeHtml(m.type)}</span>
              <span class="text-sm">- ${m.completed ? "Completed" : "Launched"} ${escapeHtml(m.dateLaunched)}</span><br/>
              <span class="text-sm"><strong>Strategy:</strong> ${escapeHtml(m.details)}</span>
              ${m.resultsBriefing ? `<br/><span class="text-sm"><strong>Results:</strong> ${escapeHtml(m.resultsBriefing)}</span>` : ""}
            </li>`,
            )
            .join("")}
        </ul>
      </div>
    `);
  }

  if (data.recentNewsResult) {
    const r = data.recentNewsResult;
    sections.push(`
      <h2>Recent News Analysis</h2>
      <div class="card">
        <h4>${escapeHtml(r.company)} <span class="text-sm">- ${escapeHtml(r.date)}</span></h4>
        <p><strong>Executive Summary:</strong> ${escapeHtml(r.data.executiveSummary)}</p>
        <h4>Key Events</h4>
        <ul>${r.data.keyEvents.map((e) => `<li><strong>${escapeHtml(e.headline)}:</strong> ${escapeHtml(e.details)}<br/><span class="text-sm">Source: ${escapeHtml(e.source)}</span></li>`).join("")}</ul>
        <h4>Toptal Opportunity</h4>
        <p>${escapeHtml(r.data.toptalOpportunity)}</p>
      </div>
    `);
  }

  if (data.icpIntelResult) {
    const i = data.icpIntelResult;
    sections.push(`
      <h2>ICP Intel Research</h2>
      <div class="card">
        <h4>${escapeHtml(i.firstName)} ${escapeHtml(i.lastName)} - ${escapeHtml(i.title)} @ ${escapeHtml(i.company)}</h4>
        <p><strong>Primary Focus:</strong> ${escapeHtml(i.result.executiveSummary.primaryFocus)}</p>
        <p><strong>Likely KPIs:</strong> ${escapeHtml(i.result.executiveSummary.likelyKPIs)}</p>
        <h4>Strategic Priorities</h4>
        <ul>${i.result.strategicPriorities.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        <h4>Recommended Talking Points</h4>
        <ul>${i.result.recommendedTalkingPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </div>
    `);
  }

  if (data.activityLogs?.length) {
    sections.push(`
      <h2>Activity History</h2>
      <div class="card">
        <ul>
          ${data.activityLogs
            .map(
              (log) => `
            <li style="margin-bottom: 12px;">
              <strong>${escapeHtml(log.type)}</strong> <span class="text-sm">- ${escapeHtml(log.date)}</span><br/>
              ${log.firstName || log.lastName || log.company ? `<em class="text-sm">with ${escapeHtml(log.firstName)} ${escapeHtml(log.lastName)} ${log.title ? `(${escapeHtml(log.title)})` : ""} ${log.company ? `@ ${escapeHtml(log.company)}` : ""}</em><br/>` : ""}
              <span style="white-space: pre-wrap;">${escapeHtml(log.notes)}</span>
            </li>`,
            )
            .join("")}
        </ul>
      </div>
    `);
  }

  if (data.eseMeetings?.length) {
    sections.push(`
      <h2>ESE Meetings</h2>
      <div class="card">
        <ul>
          ${data.eseMeetings
            .map(
              (log) => `
            <li style="margin-bottom: 12px;">
              <strong>${escapeHtml(log.account)}</strong> <span class="text-sm">- ${escapeHtml(log.date)}</span>
              ${log.notes ? `<p style="white-space: pre-wrap;">${escapeHtml(log.notes)}</p>` : ""}
            </li>`,
            )
            .join("")}
        </ul>
      </div>
    `);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(data.companyName)} - Account Report</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #334155; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { color: #1d4ed8; border-bottom: 1px solid #bfdbfe; padding-bottom: 8px; margin-top: 40px; margin-bottom: 16px; }
        h3 { color: #0f172a; margin-top: 24px; margin-bottom: 8px; font-size: 1.1rem; }
        h4 { color: #475569; margin-top: 16px; margin-bottom: 8px; font-size: 1rem; font-weight: 600; }
        p { margin-top: 0; margin-bottom: 12px; }
        .badge { display: inline-block; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 8px; border: 1px solid #e2e8f0; }
        .badge.initiative { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }
        .badge.challenge { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 16px; page-break-inside: avoid; }
        ul { margin-top: 0; padding-left: 20px; margin-bottom: 12px; }
        li { margin-bottom: 4px; }
        .italic { font-style: italic; }
        .text-sm { font-size: 0.875rem; }
        .email-body { white-space: pre-wrap; font-family: inherit; font-size: 0.875rem; margin-top: 10px; background: white; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0; }
        @media print { body { padding: 0; } @page { margin: 1cm; } }
      </style>
    </head>
    <body>
      <h1>Account R&amp;D Report: ${escapeHtml(data.companyName)}</h1>
      <p><strong>Relationship Status:</strong> ${escapeHtml(data.accountStatus || "Not defined")}</p>
      ${sections.join("\n")}
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

// Dedicated ICP Intel export — full output (executive summary, evidence,
// inferences, priorities, talking points). Same print-window approach as
// exportAccountToPdf so the user gets the browser's Save-as-PDF dialog.
export function exportIcpIntelToPdf(result: IcpIntelResult): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export the PDF.");
    return;
  }

  const r = result.result;
  const fullName = `${result.firstName} ${result.lastName}`.trim() || "Unknown";
  const sourceLink = (src: string): string => {
    if (!src || !/^https?:\/\//i.test(src)) return escapeHtml(src);
    return `<a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">${escapeHtml(src)}</a>`;
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ICP Intel - ${escapeHtml(fullName)}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #334155; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 8px; }
        .subtitle { color: #64748b; font-size: 0.95rem; margin-bottom: 24px; }
        h2 { color: #1d4ed8; border-bottom: 1px solid #bfdbfe; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-size: 1.15rem; }
        h3 { color: #0f172a; margin-top: 16px; margin-bottom: 8px; font-size: 1rem; }
        p { margin-top: 0; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 12px; page-break-inside: avoid; }
        .card .label { display: block; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        ul { margin-top: 0; padding-left: 20px; margin-bottom: 12px; }
        li { margin-bottom: 8px; }
        .item { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 8px; margin-bottom: 10px; page-break-inside: avoid; }
        .item .heading { font-weight: 600; color: #0f172a; margin-bottom: 4px; }
        .item .body { color: #475569; font-size: 0.95rem; }
        .item .source { font-size: 0.8rem; color: #64748b; margin-top: 6px; word-break: break-all; }
        .item .source a { color: #2563eb; }
        .meta { color: #64748b; font-size: 0.85rem; }
        @media print { body { padding: 0; } @page { margin: 1cm; } }
      </style>
    </head>
    <body>
      <h1>ICP Intel: ${escapeHtml(fullName)}</h1>
      <p class="subtitle">${escapeHtml(result.title)}${result.title && result.company ? " @ " : ""}${escapeHtml(result.company)}</p>
      <p class="meta">Generated ${escapeHtml(result.date)}</p>

      <h2>Executive Summary</h2>
      <div class="grid">
        <div class="card">
          <span class="label">Primary Focus</span>
          <p>${escapeHtml(r.executiveSummary.primaryFocus)}</p>
        </div>
        <div class="card">
          <span class="label">Likely KPIs</span>
          <p>${escapeHtml(r.executiveSummary.likelyKPIs)}</p>
        </div>
      </div>

      ${
        r.evidenceBackedInvolvement.length > 0
          ? `
        <h2>Evidence-Backed Involvement</h2>
        ${r.evidenceBackedInvolvement
          .map(
            (e) => `
          <div class="item">
            <div class="heading">${escapeHtml(e.confirmedProject)}</div>
            <div class="source">Source: ${sourceLink(e.verifiedSource)}</div>
          </div>`,
          )
          .join("")}
      `
          : ""
      }

      ${
        r.logicalInferences.length > 0
          ? `
        <h2>Logical Inferences</h2>
        ${r.logicalInferences
          .map(
            (i) => `
          <div class="item">
            <div class="heading">${escapeHtml(i.inferredPriority)}</div>
            <div class="body">${escapeHtml(i.reasoning)}</div>
          </div>`,
          )
          .join("")}
      `
          : ""
      }

      ${
        r.strategicPriorities.length > 0
          ? `
        <h2>Strategic Priorities</h2>
        <ul>${r.strategicPriorities.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      `
          : ""
      }

      ${
        r.recommendedTalkingPoints.length > 0
          ? `
        <h2>Recommended Talking Points</h2>
        <ul>${r.recommendedTalkingPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      `
          : ""
      }
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
