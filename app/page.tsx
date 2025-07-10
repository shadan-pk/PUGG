"use client"

import { useState } from "react"
import HomeMenu from "@/components/home-menu"
import GameLobby from "@/components/game-lobby"
import { Toaster } from "@/components/ui/toaster"

interface User {
  uid: string
  email: string
  displayName: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)

  const handleUserLogin = (userData: User) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {!user ? <HomeMenu onLogin={handleUserLogin} /> : <GameLobby user={user} onLogout={handleLogout} />}
      <Toaster />
    </main>
  )
}
