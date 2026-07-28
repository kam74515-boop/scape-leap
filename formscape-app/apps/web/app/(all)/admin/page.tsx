import { observer } from "mobx-react";
import { FormscapeAdminPage } from "@/components/formscape/AdminPage";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

function AdminPage() {
  return (
    <AuthenticationWrapper>
      <FormscapeAdminPage />
    </AuthenticationWrapper>
  );
}

export default observer(AdminPage);
