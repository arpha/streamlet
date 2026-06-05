"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Shield, Eye } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Header / Navigation */}
      <header className="w-full max-w-4xl mx-auto px-6 pt-10 pb-6 relative z-10 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        <div className="flex items-center gap-2 text-white/20 uppercase font-black text-[10px] tracking-[0.2em]">
          <Shield className="w-3.5 h-3.5" />
          Secured Platform
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-6 py-8 relative z-10 flex-grow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative"
        >
          {/* Title */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center border border-purple-500/20 shadow-lg">
              <Eye className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight italic">Privacy Policy</h1>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-0.5">Last Updated: June 3, 2026</p>
            </div>
          </div>

          {/* Policy Text */}
          <div className="space-y-8 text-white/70 text-sm md:text-base leading-relaxed font-medium">
            <p>
              Welcome to Streamlet (&quot;We&quot;, &quot;Us&quot;, &quot;Platform&quot;, or &quot;Service&quot;). 
              We highly value your privacy and are committed to protecting User (&quot;You&quot; or &quot;Your&quot;) personal data. 
              This Privacy Policy is designed to explain how we collect, use, store, and share your information when you use the Streamlet website and services.
            </p>

            <p>
              By using our Service, you agree to the collection and use of information in accordance with this policy.
            </p>

            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">1.</span> Information We Collect
              </h2>
              <p>
                We collect several types of information to provide, secure, and improve the quality of our Service to you:
              </p>
              <ul className="list-none space-y-3 pl-4">
                <li>
                  <strong className="text-white block mb-1">Third-Party Authentication Data:</strong> 
                  When you log in using Google, GitHub, Discord, or Web3 Wallet, we collect basic public information provided by those providers, such as Email Address, Profile Name, Profile Picture, Unique User ID, or Crypto Wallet Address.
                </li>
                <li>
                  <strong className="text-white block mb-1">Technical and Device Telemetry Data:</strong> 
                  To prevent bot attacks and cheating activities, our system automatically collects technical data including:
                  <ul className="list-disc pl-6 mt-1 space-y-1 text-white/60">
                    <li>IP Address (IP Address).</li>
                    <li>Device type, operating system, and browser version.</li>
                    <li>Device fingerprinting data (device fingerprinting).</li>
                    <li>Internet Service Provider (ISP) and VPN/Proxy status.</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-white block mb-1">Usage Activity Data:</strong> 
                  We record your interaction history within the application, such as reward claim times (faucets), cooldown durations, balance amounts, and referral activity.
                </li>
              </ul>
            </div>

            {/* Section 2 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">2.</span> How We Use Your Information
              </h2>
              <p>
                We use the collected data for the following purposes:
              </p>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">Providing the Service:</strong> Managing your account, recording balances, and processing reward withdrawals (withdrawal).
                </li>
                <li>
                  <strong className="text-white">Security and Anti-Fraud (Highest Priority):</strong> Detecting, preventing, and taking action against illegal activities such as multiple account creation (self-referral), the use of automated scripts (bots), or network manipulation using VPNs/Proxies.
                </li>
                <li>
                  <strong className="text-white">Analysis and Optimization:</strong> Understanding how Users use Streamlet to improve system performance and the application interface.
                </li>
                <li>
                  <strong className="text-white">Legal Compliance:</strong> Fulfilling applicable legal obligations or regulations if required by competent authorities.
                </li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">3.</span> Sharing Information with Third Parties
              </h2>
              <p>
                We will not sell, rent, or trade your personal information to outside parties. However, we work with trusted third-party services to support Streamlet&apos;s operations:
              </p>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">Infrastructure and Database Providers:</strong> We use Supabase as our database and server infrastructure manager to securely store your account and balance data.
                </li>
                <li>
                  <strong className="text-white">Security and Captcha Services:</strong> We use Cloudflare Turnstile to verify whether you are a human or a bot. This service may analyze your browser telemetry data in accordance with their own privacy policies.
                </li>
                <li>
                  <strong className="text-white">Ad Partners and Offerwalls:</strong> If you complete tasks on offerwalls or view ads, third-party ad providers may collect anonymous data from your device to display relevant ads.
                </li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">4.</span> Data Storage and Security
              </h2>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">Security:</strong> We use encryption methods and modern security standards to protect your data from unauthorized access. However, please remember that no method of transmission over the internet or method of electronic storage is 100% secure.
                </li>
                <li>
                  <strong className="text-white">Data Retention:</strong> We will retain your personal data for as long as your account is active or as needed to provide services and comply with our anti-cheat policies.
                </li>
              </ul>
            </div>

            {/* Section 5 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">5.</span> Cookies Policy
              </h2>
              <p>
                Streamlet uses cookies and similar tracking technologies to store your login sessions so you do not have to log in repeatedly every time you open the application, as well as to help identify device characteristics for security purposes. You can set your browser to refuse cookies, but some main features of Streamlet may not function properly.
              </p>
            </div>

            {/* Section 6 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">6.</span> User Rights
              </h2>
              <p>
                You have the right to access, update, or request the deletion of your personal information stored in our system. If you wish to delete your Streamlet account along with all the data in it, you can contact us through the official support channels provided.
              </p>
            </div>

            {/* Section 7 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">7.</span> Changes to This Privacy Policy
              </h2>
              <p>
                We may update our Privacy Policy from time to time. Any changes will be notified by updating the &quot;Last Updated&quot; date at the top of this page. You are advised to review this Privacy Policy periodically for the latest developments.
              </p>
            </div>

            {/* Section 8 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">8.</span> Contact Us
              </h2>
              <p>
                If you have questions or concerns regarding this Privacy Policy, please contact us at:
              </p>
              <ul className="list-none space-y-1 pl-4">
                <li>
                  <strong className="text-white">Email:</strong>{" "}
                  <a href="mailto:support@streamlet.fun" className="text-purple-400 hover:underline font-bold">
                    support@streamlet.fun
                  </a>
                </li>
                <li>
                  <strong className="text-white">Community Channels:</strong> Official Discord/Telegram Community
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 px-6 mt-12 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/30 font-bold uppercase tracking-wider">
          <p>© 2026 Streamlet Development. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <a href="https://t.me/streamletfaucet" target="_blank" rel="noopener noreferrer" className="text-sky-455 hover:text-sky-400 transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-1 .53-1.42.52-.47-.01-1.37-.27-2.03-.49-.82-.27-1.47-.41-1.42-.87.03-.24.36-.49.99-.74 3.89-1.69 6.48-2.8 7.77-3.32 3.7-1.5 4.46-1.76 4.96-1.77.11 0 .36.03.52.16.13.11.17.27.18.38 0 .08-.01.27-.02.35z"/>
              </svg>
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
