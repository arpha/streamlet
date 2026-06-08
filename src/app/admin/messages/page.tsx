"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, MessageSquare, CheckCircle2, Users, AlertCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function AdminMessagesPage() {
  const { isAdmin, id: userId } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [sendToAll, setSendToAll] = useState(false)
  const [searchUsername, setSearchUsername] = useState("")
  const [selectedUser, setSelectedUser] = useState<{ id: string, username: string } | null>(null)
  const [userResults, setUserResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recentMessages, setRecentMessages] = useState<any[]>([])

  useEffect(() => {
    if (!isAdmin) {
      router.push("/")
    } else {
      fetchRecentMessages()
    }
  }, [isAdmin, router])

  const fetchRecentMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('user_messages')
        .select('*, profiles!user_messages_user_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentMessages(data || [])
    } catch (error: any) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearchUser = async (value: string) => {
    setSearchUsername(value)
    if (value.length < 3) {
      setUserResults([])
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${value}%`)
        .limit(5)

      if (error) throw error
      setUserResults(data || [])
    } catch (error: any) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required")
      return
    }

    if (!sendToAll && !selectedUser) {
      toast.error("Please select a user or choose to send to all")
      return
    }

    setIsSending(true)
    try {
      if (sendToAll) {
        // Broadcast
        const { data, error } = await supabase.rpc('send_message_to_all_users', {
          p_title: title,
          p_content: content
        })

        if (error) throw error
        
        if (data && data.success) {
            toast.success(`Message sent to all ${data.count} users!`)
        } else {
            toast.error(data?.message || "Failed to broadcast message")
        }
      } else {
        // Send to specific user
        const { error } = await supabase
          .from('user_messages')
          .insert({
            user_id: selectedUser!.id,
            title,
            content
          })

        if (error) throw error
        toast.success(`Message sent to ${selectedUser!.username}!`)
      }

      // Reset form
      setTitle("")
      setContent("")
      setSelectedUser(null)
      setSearchUsername("")
      setSendToAll(false)
      fetchRecentMessages()
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_messages')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success("Message deleted")
      fetchRecentMessages()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete message")
    }
  }

  if (!isAdmin) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
          <MessageSquare className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Broadcast Messages</h1>
          <p className="text-white/60 font-bold">Send announcements or direct messages to players</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass border-white/10 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">Compose Message</CardTitle>
            <CardDescription className="text-white/60">Fill out the form below to send a message.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-white/80">Recipient</label>
              <div className="flex items-center gap-4">
                <Button 
                  type="button"
                  variant={!sendToAll ? "default" : "outline"}
                  onClick={() => setSendToAll(false)}
                  className={`flex-1 rounded-xl font-bold ${!sendToAll ? 'bg-primary text-white hover:bg-primary/90' : 'bg-transparent border-white/10 text-white/60 hover:bg-white/5'}`}
                >
                  Specific User
                </Button>
                <Button 
                  type="button"
                  variant={sendToAll ? "default" : "outline"}
                  onClick={() => setSendToAll(true)}
                  className={`flex-1 rounded-xl font-bold ${sendToAll ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700' : 'bg-transparent border-white/10 text-white/60 hover:bg-white/5'}`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  All Users
                </Button>
              </div>

              {!sendToAll && (
                <div className="pt-2 relative">
                  {selectedUser ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="font-bold text-white">{selectedUser.username}</span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="h-8 hover:bg-white/10 text-white/60 rounded-lg">
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input 
                        placeholder="Search username..." 
                        value={searchUsername}
                        onChange={(e) => handleSearchUser(e.target.value)}
                        className="bg-black/20 border-white/10 text-white rounded-xl"
                      />
                      {isSearching && (
                        <Loader2 className="w-4 h-4 text-white/40 animate-spin absolute right-3 top-3" />
                      )}
                      {userResults.length > 0 && searchUsername.length >= 3 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10">
                          {userResults.map(user => (
                            <button
                              key={user.id}
                              className="w-full text-left px-4 py-3 hover:bg-white/5 text-white/80 font-bold border-b border-white/5 last:border-0 transition-colors"
                              onClick={() => {
                                setSelectedUser(user)
                                setSearchUsername("")
                                setUserResults([])
                              }}
                            >
                              {user.username}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-white/80">Message Title</label>
              <Input 
                placeholder="e.g. Server Maintenance, Special Bonus!" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-black/20 border-white/10 text-white rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-white/80">Message Content</label>
              <Textarea 
                placeholder="Write your message here..." 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-black/20 border-white/10 text-white rounded-xl min-h-[150px] resize-none"
              />
            </div>

            <Button 
              onClick={handleSend} 
              disabled={isSending || (!sendToAll && !selectedUser) || !title || !content}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-fuchsia-600 text-white font-bold h-12 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xl text-white">Recent Messages Sent</CardTitle>
            <CardDescription className="text-white/60">The last 10 messages sent to users.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/40">
                <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                <span className="font-bold">No messages sent recently</span>
              </div>
            ) : (
              <div className="space-y-4">
                {recentMessages.map((msg) => (
                  <div key={msg.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-primary tracking-widest">
                        To: {msg.profiles?.username || 'Unknown User'}
                      </span>
                      <button onClick={() => handleDelete(msg.id)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-rose-500/20 text-rose-400 rounded-lg transition-all hover:bg-rose-500 hover:text-white absolute right-3 top-3">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-white text-lg leading-tight pr-8">{msg.title}</h3>
                    <p className="text-sm text-white/60 line-clamp-2">{msg.content}</p>
                    <div className="flex items-center gap-2 pt-2">
                      <Badge variant="outline" className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${msg.is_read ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                        {msg.is_read ? 'Read' : 'Unread'}
                      </Badge>
                      <span className="text-[10px] text-white/40 font-bold">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
