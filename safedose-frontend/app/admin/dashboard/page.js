// app/admin/dashboard/page.js
// Redirects to the new Pending Approvals page.

import { redirect } from 'next/navigation';

export default function AdminDashboardRedirect() {
  redirect('/admin/pending');
}
