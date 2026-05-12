import { Tabs } from "antd";
import { useSearchParams } from "react-router-dom";
import OrganizationsTab from "./tabs/OrganizationsTab";
import UserGroupsTab from "./tabs/UserGroupsTab";
import UsersTab from "./tabs/UsersTab";

export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "organizations";

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="title">Quản trị hệ thống</h2>
          <p className="subtitle">Quản lý tổ chức, nhóm quyền và người dùng</p>
        </div>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(key) => setParams({ tab: key })}
        type="card"
        items={[
          {
            key: "organizations",
            label: "Tổ chức",
            children: <OrganizationsTab />
          },
          {
            key: "user-groups",
            label: "Nhóm vai trò",
            children: <UserGroupsTab />
          },
          {
            key: "users",
            label: "Người dùng",
            children: <UsersTab />
          }
        ]}
      />
    </>
  );
}
