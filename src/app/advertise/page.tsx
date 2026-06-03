"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Megaphone, MousePointer2, Image as ImageIcon, CheckCircle2, AlertTriangle } from "lucide-react"

export default function AdvertisePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Advertise</h2>
          <p className="text-muted-foreground">Promote your website to thousands of crypto enthusiasts.</p>
        </div>
        <Button className="neon-glow font-bold gap-2">
          <Megaphone className="w-4 h-4" /> CREATE CAMPAIGN
        </Button>
      </div>

      <Tabs defaultValue="ptc" className="w-full">
        <TabsList className="grid w-full grid-cols-2 glass p-1">
          <TabsTrigger value="ptc" className="gap-2 data-[state=active]:bg-primary transition-all">
            <MousePointer2 className="w-4 h-4" /> PTC Ads
          </TabsTrigger>
          <TabsTrigger value="banner" className="gap-2 data-[state=active]:bg-primary transition-all">
            <ImageIcon className="w-4 h-4" /> Banner Ads
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ptc" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass h-fit">
              <CardHeader>
                <CardTitle>PTC Pricing</CardTitle>
                <CardDescription>Price per view based on duration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { duration: 10, price: '0.00000100' },
                  { duration: 30, price: '0.00000250' },
                  { duration: 60, price: '0.00000400' },
                ].map((tier) => (
                  <div key={tier.duration} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="font-medium">{tier.duration} Seconds</span>
                    <span className="font-bold text-primary font-mono">{tier.price} BTC</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="Best Crypto Project" className="glass border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Campaign URL</Label>
                  <Input id="url" placeholder="https://example.com" className="glass border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="views">Number of Views</Label>
                  <Input id="views" type="number" placeholder="1000" className="glass border-white/10" />
                </div>
                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">Total Cost:</div>
                  <div className="text-xl font-bold font-mono text-primary">0.00000000 BTC</div>
                </div>
                <Button className="w-full h-12 neon-glow font-bold">SUBMIT CAMPAIGN</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="banner" className="mt-6">
          <Card className="glass border-dashed border-primary/20 bg-primary/5 py-12">
            <CardContent className="flex flex-col items-center text-center gap-4">
              <AlertTriangle className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-bold">Banner Ads Coming Soon</h3>
              <p className="text-muted-foreground max-w-sm">
                We are currently integrating our self-serve banner advertising platform. Contact support for direct placements.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { icon: CheckCircle2, title: 'Real Traffic', desc: 'No bots allowed. Our multi-layer anti-cheat system ensures real human views.' },
          { icon: CheckCircle2, title: 'Instant Start', desc: 'Your campaign starts running immediately after approval.' },
          { icon: CheckCircle2, title: 'Detailed Stats', desc: 'Track your campaign performance with real-time analytics.' },
        ].map((item, i) => (
          <div key={i} className="flex gap-4 p-4 rounded-2xl glass border-white/5">
            <item.icon className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-bold">{item.title}</h4>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
