import { useTranslation } from "react-i18next";
import { PictureIcon } from "./icons";

export default function EmptyState({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-600">
      <PictureIcon className="w-16 h-16 opacity-20" />
      <p className="text-sm">{t("app.openToBegin")}</p>
      <button
        onClick={onOpen}
        className="px-4 py-2 bg-accent hover:bg-accent-hover rounded text-sm font-medium text-white transition-colors"
      >
        {t("toolbar.openEvent")}
      </button>
    </div>
  );
}
