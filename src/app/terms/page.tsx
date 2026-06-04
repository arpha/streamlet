"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Shield, FileText } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[150px]" />
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
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight italic">Terms of Service</h1>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-0.5">Last Updated: June 3, 2026</p>
            </div>
          </div>

          {/* Policy Text */}
          <div className="space-y-8 text-white/70 text-sm md:text-base leading-relaxed font-medium">
            <p>
              Welcome to Streamlet (hereinafter referred to as &quot;Service&quot;, &quot;We&quot;, &quot;Us&quot;, or &quot;Platform&quot;). 
              By accessing, registering, or using the Streamlet website and services, you (hereinafter referred to as 
              &quot;User&quot; or &quot;You&quot;) knowingly declare that you have read, understood, and agreed to be bound by all the provisions in this Terms of Service document.
            </p>

            <p className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-rose-300 font-bold text-xs uppercase tracking-wider">
              If you do not agree to any or all of these terms, you are strictly prohibited from using our Service.
            </p>

            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">1.</span> Eligibility and Account Authentication
              </h2>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">1.1. Age Restriction:</strong> You must be at least 13 years old (or the legal age in your country of residence) to use this Service.
                </li>
                <li>
                  <strong className="text-white">1.2. Third-Party Authentication:</strong> Streamlet uses third-party authentication services (such as Google, GitHub, Discord, or Web3 Wallet). You are fully responsible for the security of your third-party account. We are not responsible for any loss resulting from your negligence in maintaining the security of that account.
                </li>
                <li>
                  <strong className="text-white">1.3. One Human, One Account Policy:</strong> Each individual is only allowed to own, manage, and access 1 (one) account on Streamlet.
                </li>
              </ul>
            </div>

            {/* Section 2 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">2.</span> Anti-Cheat and Abuse Policy
              </h2>
              <p>
                Streamlet applies a zero-tolerance policy against all forms of cheating to maintain the fairness of the ecosystem. The following actions are strictly prohibited and categorized as major violations:
              </p>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">2.1. Use of Automation (Bots):</strong> The use of scripts, bots, emulators, macro software, or any automation tools to claim rewards (faucets) or manipulate the system.
                </li>
                <li>
                  <strong className="text-white">2.2. Referral Abuse (Self-Referral):</strong> Creating additional accounts (cloning) using your own referral link to obtain bonuses or one-sided benefits.
                </li>
                <li>
                  <strong className="text-white">2.3. Network Manipulation:</strong> Using VPNs, Proxies, Tor networks, VPS, or any other IP address manipulation methods to deceive the location detection system or create multiple accounts from the same device.
                </li>
                <li>
                  <strong className="text-white">2.4. Security Exploits:</strong> Exploiting bugs, security loopholes, or race conditions in the application code or database to duplicate reward claims (double-spending).
                </li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">3.</span> Right of Unilateral Suspension, Limitation, and Account Termination
              </h2>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">3.1. Internal Audit Rights:</strong> We have full rights to monitor account activity, analyze device fingerprinting, IP reputation, and User claim patterns to detect suspicious activity.
                </li>
                <li>
                  <strong className="text-white">3.2. Unilateral Action:</strong> If our system or team detects or suspects indications of violations in Section 2, Streamlet reserves the full right to unilaterally:
                  <ul className="list-disc pl-6 mt-2 space-y-1 text-white/60">
                    <li>Freeze or close your account without prior notice.</li>
                    <li>Withhold, cancel, or delete all collected reward balances.</li>
                    <li>Apply functional restrictions to the account silently (Shadow Ban or suspension of withdrawals).</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-white">3.3. No Compensation:</strong> Streamlet is under no obligation to provide compensation, indemnity, or detailed explanations for accounts acted upon due to being indicated by the system as cheaters or bot networks.
                </li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">4.</span> Rewards &amp; Withdrawals Policy
              </h2>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">4.1. Nature of Rewards:</strong> Points, tokens, or digital assets listed in your account balance on the Streamlet platform are optional rewards and do not constitute an official investment instrument or a guarantee of fixed financial value.
                </li>
                <li>
                  <strong className="text-white">4.2. Value Changes:</strong> Streamlet reserves the right to change reward amounts, cooldown durations, and minimum withdrawal thresholds at any time without prior written notice, adjusting to the platform&apos;s financial stability conditions.
                </li>
                <li>
                  <strong className="text-white">4.3. Transaction Fees:</strong> All forms of transaction fees (including blockchain network gas fees or transfer fees) arising from the reward withdrawal process may be charged directly to the User&apos;s balance in accordance with the policies in force at that time.
                </li>
              </ul>
            </div>

            {/* Section 5 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">5.</span> Limitation of Liability
              </h2>
              <ul className="list-none space-y-2 pl-4">
                <li>
                  <strong className="text-white">5.1. &quot;As Is&quot; Service:</strong> This Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do not guarantee that the Service will always be free from technical disruptions, downtime, or temporary data loss.
                </li>
                <li>
                  <strong className="text-white">5.2. Financial Loss:</strong> We are not responsible for financial loss, failed withdrawals due to destination address errors by the User, changes in local government regulations, or losses caused by global-scale third-party hacking attacks.
                </li>
              </ul>
            </div>

            {/* Section 6 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">6.</span> Modifications
              </h2>
              <p>
                We reserve the right to modify or update this Terms of Service at any time. Changes will take effect immediately after the latest version is uploaded on the Streamlet website. You are advised to check this page periodically. Continued use of the Service after changes indicates your agreement to the new terms.
              </p>
            </div>

            {/* Section 7 */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span className="text-purple-400">7.</span> Official Contact
              </h2>
              <p>
                If you have questions about these Terms and Conditions, you can contact us through community official channels or email at:{" "}
                <a href="mailto:support@streamlet.fun" className="text-purple-400 hover:underline font-bold">
                  support@streamlet.fun
                </a>
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Ad Banner */}
      <div className="w-full max-w-4xl mx-auto px-6 mb-8 relative z-10">
        <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
          <iframe 
            data-aa='2441223' 
            src='//acceptable.a-ads.com/2441223/?size=Adaptive'
            style={{ border: 0, padding: 0, width: '70%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 px-6 mt-6 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/30 font-bold uppercase tracking-wider">
          <p>© 2026 Streamlet Development. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/auth/login" className="hover:text-white transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
