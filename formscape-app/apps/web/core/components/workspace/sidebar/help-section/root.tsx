/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { HelpCircle, User } from "@/icons";
import { useTranslation } from "@plane/i18n";
import { PageIcon } from "@plane/propel/icons";
// ui
import { CustomMenu } from "@plane/ui";
// components
import { ProductUpdatesModal } from "@/components/global";
import { PlaneVersionNumber } from "@/components/global/version-number";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";

export const HelpMenuRoot = observer(function HelpMenuRoot() {
  // store hooks
  const { t } = useTranslation();
  const { toggleShortcutsListModal } = usePowerK();
  // states
  const [isNeedHelpOpen, setIsNeedHelpOpen] = useState(false);
  const [isProductUpdatesModalOpen, setProductUpdatesModalOpen] = useState(false);

  return (
    <>
      <ProductUpdatesModal isOpen={isProductUpdatesModalOpen} handleClose={() => setProductUpdatesModalOpen(false)} />

      <CustomMenu
        customButton={
          <span className="group flex flex-col items-center justify-center gap-0.5 text-tertiary">
            <span
              className={`flex size-8 items-center justify-center rounded-md ${
                isNeedHelpOpen
                  ? "bg-layer-transparent-selected text-icon-primary"
                  : "text-icon-tertiary group-hover:bg-layer-transparent-hover group-hover:text-icon-secondary"
              }`}
            >
              <HelpCircle className="size-5" />
            </span>
            <span className="sr-only">帮助与支持</span>
          </span>
        }
        customButtonClassName="flex items-center justify-center outline-none"
        menuButtonOnClick={() => !isNeedHelpOpen && setIsNeedHelpOpen(true)}
        onMenuClose={() => setIsNeedHelpOpen(false)}
        placement="right-start"
        maxHeight="lg"
        closeOnSelect
      >
        <CustomMenu.MenuItem onClick={() => window.open("https://formscape.com", "_blank")}>
          <div className="flex items-center gap-x-2 rounded-sm text-11">
            <PageIcon className="h-3.5 w-3.5 text-secondary" height={14} width={14} />
            <span className="text-11">关于构境AI</span>
          </div>
        </CustomMenu.MenuItem>
        <CustomMenu.MenuItem onClick={() => window.open("mailto:support@formscape.ai", "_blank")}>
          <div className="flex items-center gap-x-2 rounded-sm text-11">
            <User className="h-3.5 w-3.5 text-secondary" size={14} />
            <span className="text-11">联系支持</span>
          </div>
        </CustomMenu.MenuItem>
        <div className="my-1 border-t border-subtle" />
        <CustomMenu.MenuItem onClick={() => toggleShortcutsListModal(true)}>
          <div className="flex w-full items-center">
            <span className="text-11">{t("keyboard_shortcuts")}</span>
          </div>
        </CustomMenu.MenuItem>
        <CustomMenu.MenuItem onClick={() => setProductUpdatesModalOpen(true)}>
          <div className="flex w-full items-center">
            <span className="text-11">{t("whats_new")}</span>
          </div>
        </CustomMenu.MenuItem>
        <CustomMenu.MenuItem
          onClick={() => window.open("mailto:support@formscape.ai", "_blank", "noopener,noreferrer")}
        >
          <div className="flex items-center gap-x-2 rounded-sm text-11">
            <span className="text-11">反馈建议</span>
          </div>
        </CustomMenu.MenuItem>
        <div className="mt-1 border-t border-subtle px-1 pt-2 text-11 text-secondary">
          <PlaneVersionNumber />
        </div>
      </CustomMenu>
    </>
  );
});
