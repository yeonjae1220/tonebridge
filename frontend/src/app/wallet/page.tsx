import { redirect } from 'next/navigation'

// Preserve old bookmarks without making currency part of the learning flow.
export default function WalletPage() {
  redirect('/study')
}
