import { fixture } from "@/lib/fixtures";

export default function AccountPage() {
  return (
    <>
      <h1 className="page-title">Account management</h1>
      <table className="data-table mt-4">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {fixture.billingMembers.map((member) => (
            <tr key={member.id}>
              <td>
                {member.name}
                {member.isYou ? " (you)" : ""}
              </td>
              <td>{member.email}</td>
              <td>{member.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
