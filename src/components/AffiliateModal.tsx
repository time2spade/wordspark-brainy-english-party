import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  ExternalLink, 
  Save, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  Megaphone,
  Mail,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  SPONSORS, 
  getStoredAffiliateUrl, 
  setAffiliateUrl, 
  getAffiliateClicks, 
  resetAffiliateClicks,
  hasActiveSponsors,
  setSponsorsEnabled,
  getSponsorContactEmail,
  setSponsorContactEmail
} from '../ads';
import { sounds } from '../audio';

interface AffiliateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AffiliateModal({ isOpen, onClose }: AffiliateModalProps) {
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [isSponsorsActive, setIsSponsorsActive] = useState<boolean>(() => hasActiveSponsors());
  const [contactEmail, setContactEmail] = useState<string>(() => getSponsorContactEmail());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialLinks: Record<string, string> = {};
      SPONSORS.forEach(s => {
        initialLinks[s.id] = getStoredAffiliateUrl(s.id);
      });
      setCustomLinks(initialLinks);
      setClicks(getAffiliateClicks());
      setIsSponsorsActive(hasActiveSponsors());
      setContactEmail(getSponsorContactEmail());
      setSaveSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playSuccess();
    Object.entries(customLinks).forEach(([id, url]) => {
      setAffiliateUrl(id, url);
    });
    setSponsorsEnabled(isSponsorsActive);
    setSponsorContactEmail(contactEmail);

    setSaveSuccessMsg('Settings saved! Banner updates take effect immediately.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleResetClicks = () => {
    sounds.playClick();
    resetAffiliateClicks();
    setClicks({});
  };

  const totalClicks = clicks['_total'] || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#141c30] border border-slate-700/80 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Sponsor & Monetization Manager
              </span>
            </div>
            <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold px-2 py-0.5 rounded-full">
              🔒 Admin Access Only (Hidden from Public Players)
            </span>
          </div>
          <h3 className="text-2xl font-display font-extrabold text-white mt-1">
            Advertising & Sponsor Controls
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Configure direct sponsor inquiry contacts or activate custom affiliate links for your Smart Sponsor Banners.
          </p>
        </div>

        {/* SPONSOR BANNER MODE TOGGLE */}
        <div className="bg-[#0e1628] border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {isSponsorsActive ? 'Active Sponsor Ads: ENABLED' : 'No Sponsors Yet: Showing "Contact for Ads" Banner'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isSponsorsActive 
                  ? 'Displays rotating brand sponsor banners (Duolingo, Grammarly, etc.) with affiliate tracking.'
                  : 'Hides all third-party ads and instead displays a clean banner inviting advertisers to contact you.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setIsSponsorsActive(!isSponsorsActive);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
              isSponsorsActive
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            {isSponsorsActive ? (
              <>
                <ToggleRight className="w-4 h-4" />
                <span>Brand Ads Active</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>Contact Banner Mode</span>
              </>
            )}
          </button>
        </div>

        {/* DIRECT SPONSOR CONTACT EMAIL */}
        <div className="bg-[#0b101d] p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Advertiser Inquiries Contact Email:</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="e.g. T2Spade@gmail.com"
            className="w-full bg-[#12192b] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono outline-none"
          />
          <span className="text-[10px] text-slate-500 block">
            This email is shown in the "Contact for Ads" popup so brands and sponsors can contact you directly.
          </span>
        </div>

        {/* Real-time Click Analytics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0b101d] p-3.5 rounded-2xl border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Total Ad Clicks</span>
            <span className="text-2xl font-display font-black text-amber-400 tabular-nums">{totalClicks}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Active Partners</span>
            <span className="text-2xl font-display font-black text-cyan-400">{SPONSORS.length}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Estimated Range</span>
            <span className="text-sm font-display font-black text-emerald-400 block mt-1">$0.20 – $65/action</span>
          </div>
          <div className="flex items-end justify-start sm:justify-end">
            <button
              onClick={handleResetClicks}
              className="text-[10px] text-slate-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer py-1"
              title="Reset local click count"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Clicks</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccessMsg && (
          <div className="bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Partner Configuration List */}
        <form onSubmit={handleSaveAll} className="space-y-4">
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Pre-Configured Affiliate Partners:
            </span>

            {SPONSORS.map((sponsor) => {
              const currentClicks = clicks[sponsor.id] || 0;
              const hasCustom = Boolean(customLinks[sponsor.id]?.trim());

              return (
                <div 
                  key={sponsor.id} 
                  className="bg-[#0e1628] border border-slate-800/90 rounded-2xl p-4 space-y-2.5 transition-all hover:border-slate-700"
                >
                  {/* Top Bar of Partner Card */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${sponsor.iconBg} flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                        {sponsor.iconEmoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-white">{sponsor.brand}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-medium">
                            {sponsor.affiliateProgram}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-semibold block">
                          Payout: {sponsor.estimatedPayout}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 bg-[#0b101d] px-2 py-0.5 rounded-lg border border-slate-800">
                        Clicks: <strong className="text-amber-400 font-mono">{currentClicks}</strong>
                      </span>
                      <a
                        href={sponsor.signUpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-cyan-300 hover:text-white font-bold px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Sign up for this affiliate program"
                      >
                        <span>Sign Up</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Input field for custom affiliate link */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Your Affiliate / Referral Link:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={customLinks[sponsor.id] || ''}
                        onChange={(e) => setCustomLinks(prev => ({ ...prev, [sponsor.id]: e.target.value }))}
                        placeholder={`Paste your ${sponsor.brand} affiliate link or leave blank for default...`}
                        className="flex-1 bg-[#0b101d] border border-slate-700/80 focus:border-emerald-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
                      />
                      <a
                        href={customLinks[sponsor.id] || sponsor.defaultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                        title="Test link in new tab"
                      >
                        <span>Test</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {hasCustom ? (
                        <span className="text-emerald-400 font-semibold">✓ Custom affiliate link active!</span>
                      ) : (
                        <span>Default tracking link active with WordSpark UTM tags.</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Settings persist in your browser and route all live banners.</span>
            </div>

            <button
              type="submit"
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 active:translate-y-0.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
