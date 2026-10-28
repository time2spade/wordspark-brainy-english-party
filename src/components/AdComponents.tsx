import React, { useState, useEffect } from 'react';
import { ExternalLink, Mail, Copy, Check, Megaphone, X, Sparkles } from 'lucide-react';
import { 
  SPONSORS, 
  getAffiliateUrl, 
  trackAffiliateClick, 
  hasActiveSponsors, 
  getSponsorContactEmail 
} from '../ads';
import { sounds } from '../audio';

interface AdBannerProps {
  compact?: boolean;
}

export function AdBanner({ compact = false }: AdBannerProps) {
  const [sponsorsEnabled, setSponsorsEnabled] = useState<boolean>(() => hasActiveSponsors());
  const [sponsorIndex, setSponsorIndex] = useState<number>(0);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const contactEmail = getSponsorContactEmail();
  const sponsor = SPONSORS[sponsorIndex % SPONSORS.length];

  // Refresh sponsor state periodically
  useEffect(() => {
    setSponsorsEnabled(hasActiveSponsors());
  }, []);

  // Auto rotate banner sponsor every 18 seconds if active
  useEffect(() => {
    if (!sponsorsEnabled) return;
    const timer = setInterval(() => {
      setSponsorIndex(prev => prev + 1);
    }, 18000);
    return () => clearInterval(timer);
  }, [sponsorsEnabled]);

  const affiliateUrl = getAffiliateUrl(sponsor.id);

  const handleBannerClick = () => {
    sounds.playClick();
    trackAffiliateClick(sponsor.id);
  };

  const handleCopyEmail = () => {
    sounds.playClick();
    try {
      navigator.clipboard?.writeText(contactEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {}
  };

  // ----------------------------------------------------
  // CASE 1: NO ACTIVE SPONSORS YET -> SHOW CONTACT CHANNEL
  // ----------------------------------------------------
  if (!sponsorsEnabled) {
    return (
      <>
        <div className={`w-full bg-[#0d1424] border border-amber-500/30 hover:border-amber-500/60 rounded-2xl overflow-hidden transition-all duration-300 shadow-md ${
          compact ? 'p-2.5' : 'p-3 sm:p-3.5'
        }`}>
          <div className="flex items-center justify-between gap-3">
            {/* Left: Sponsor Inquiry Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-md text-slate-950">
                <Megaphone className="w-5 h-5 text-slate-950" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Sponsor Space
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    Promote Your Brand Here
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline truncate">
                    · Reach daily vocabulary & language learners
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  Interested in sponsoring WordSpark? Place your banner or sponsored words here.
                </p>
              </div>
            </div>

            {/* Right: Contact Action Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setShowContactModal(true);
                }}
                className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:translate-y-0.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact for Ads</span>
              </button>
            </div>
          </div>
        </div>

        {/* SPONSOR CONTACT / ADVERTISING INQUIRY MODAL */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#141c30] border border-amber-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-4">
              <button
                onClick={() => setShowContactModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2.5">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                  Sponsor & Advertise on WordSpark
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Connect your brand or educational course directly with thousands of active English learners and word gamers.
                </p>
              </div>

              {/* Benefits card */}
              <div className="bg-[#0b101d] p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Sponsorship Placements:</span>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-400 pl-6 list-disc">
                  <li>Smart Sponsor Banners on Home, Daily Rankings & Game Over screens.</li>
                  <li>Targeted audience: Students, ESL learners & exam candidates.</li>
                  <li>Custom campaign tracking and direct URL placement.</li>
                </ul>
              </div>

              {/* Direct Email Channel */}
              <div className="bg-[#0b101d] p-3.5 rounded-2xl border border-amber-500/30 space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Official Sponsor Contact Email:
                </span>
                <div className="flex items-center justify-between gap-2 bg-[#12192b] p-2.5 rounded-xl border border-slate-700/80 font-mono text-xs text-amber-300">
                  <span className="truncate">{contactEmail}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
                    title="Copy email address"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {copied && (
                  <p className="text-[10px] text-emerald-400 font-semibold text-center animate-in fade-in">
                    ✓ Email address copied to clipboard!
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2.5 pt-1">
                <a
                  href={`mailto:${contactEmail}?subject=WordSpark%20Sponsorship%20Inquiry`}
                  onClick={() => sounds.playClick()}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:translate-y-0.5"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Email Inquiry</span>
                </a>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ----------------------------------------------------
  // CASE 2: ACTIVE SPONSORS ENABLED -> SHOW BRAND BANNER
  // ----------------------------------------------------
  return (
    <div className={`w-full bg-[#0d1424] border border-slate-800/90 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700 shadow-md ${
      compact ? 'p-2.5' : 'p-3 sm:p-3.5'
    }`}>
      <div className="flex items-center justify-between gap-3">
        {/* Left: Sponsor Icon + Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${sponsor.iconBg} flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-md`}>
            {sponsor.iconEmoji}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded bg-slate-800 text-amber-400 border border-slate-700">
                Sponsor
              </span>
              <span className="text-xs font-bold text-white truncate">
                {sponsor.brand}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline truncate">
                · {sponsor.tagline}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              {sponsor.headline}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleBannerClick}
            className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
            title={`Visit ${sponsor.brand}`}
          >
            <span>Visit</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
