// app/admin/requests/page.js

"use client";
import "../admin.css";
import { useState, useEffect } from "react";

function initials(first, last) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function CaregiverDetailsModal({ caregiver, onClose }) {
  const profile = caregiver.caregiverProfile || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500 }}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Caregiver Application Details</h3>
            <p className="modal-sub">
              {caregiver.firstName} {caregiver.lastName}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="18"
              height="18"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 20, display: "grid", gap: 12, fontSize: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <strong
                style={{
                  display: "block",
                  color: "var(--gray500)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Email
              </strong>{" "}
              {caregiver.email}
            </div>
            <div>
              <strong
                style={{
                  display: "block",
                  color: "var(--gray500)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Gender
              </strong>{" "}
              {caregiver.gender || "N/A"}
            </div>
          </div>
          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--gray200)",
              margin: "8px 0",
            }}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <strong
                style={{
                  display: "block",
                  color: "var(--gray500)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Qualification
              </strong>{" "}
              {profile.qualification || "N/A"}
            </div>
            <div>
              <strong
                style={{
                  display: "block",
                  color: "var(--gray500)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Specialization
              </strong>{" "}
              {profile.specialization || "N/A"}
            </div>
            <div>
              <strong
                style={{
                  display: "block",
                  color: "var(--gray500)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Experience
              </strong>{" "}
              {profile.experienceYears
                ? `${profile.experienceYears} years`
                : "N/A"}
            </div>
            <div>
              <strong
                style={{
                  display: "block",
                  color: "var(--gray500)",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                License ID
              </strong>{" "}
              {profile.licenseId || "N/A"}
            </div>
          </div>
          <div>
            <strong
              style={{
                display: "block",
                color: "var(--gray500)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Languages
            </strong>{" "}
            {profile.languagesSpoken || "N/A"}
          </div>
          <div>
            <strong
              style={{
                display: "block",
                color: "var(--gray500)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Availability
            </strong>{" "}
            {profile.availability || "N/A"}
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-teal btn-full"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendingRequestsPage() {
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewDetails, setViewDetails] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/caregivers", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        // Only keep pending caregivers
        const pending = (data.caregivers || []).filter(
          (c) => c.status === "pending",
        );
        setCaregivers(pending);
      } catch (err) {
        console.error(err);
        setError("Failed to load requests.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUpdateStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/admin/caregivers/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      if (res.ok) {
        // Remove from pending list
        setCaregivers((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Pending Requests</h2>
          <p>Review and approve new caregiver accounts</p>
        </div>
        <div className="topbar-right">
          <div className="topbar-avatar" style={{ background: "#7c3aed" }}>
            A
          </div>
        </div>
      </div>

      <main className="app-main">
        <div className="card-box" style={{ padding: 24 }}>
          {loading ? (
            <div className="admin-empty">Loading requests…</div>
          ) : error ? (
            <div className="admin-empty" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          ) : caregivers.length === 0 ? (
            <div className="admin-empty">No pending requests at this time.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Email</th>
                    <th>Date Applied</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {caregivers.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-avatar caregiver">
                            {initials(c.firstName, c.lastName)}
                          </div>
                          <div>
                            <div className="admin-user-name">
                              {c.firstName} {c.lastName}
                            </div>
                            {c.caregiverProfile?.qualification && (
                              <div
                                className="admin-user-email"
                                style={{ fontSize: 12 }}
                              >
                                {c.caregiverProfile.qualification}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{c.email}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            className="admin-action-btn edit"
                            onClick={() => setViewDetails(c)}
                          >
                            View Details
                          </button>
                          <button
                            className="admin-action-btn"
                            style={{ color: "#10b981", fontWeight: 600 }}
                            onClick={() => handleUpdateStatus(c._id, "active")}
                          >
                            Approve
                          </button>
                          <button
                            className="admin-action-btn"
                            style={{ color: "#ef4444", fontWeight: 600 }}
                            onClick={() =>
                              handleUpdateStatus(c._id, "rejected")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {viewDetails && (
        <CaregiverDetailsModal
          caregiver={viewDetails}
          onClose={() => setViewDetails(null)}
        />
      )}
    </>
  );
}
