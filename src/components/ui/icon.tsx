import { Show, Switch, Match, splitProps, type ComponentProps } from "solid-js";

export type IconName = "panelLeft" | "panelLeftClose" | "house" | "dumbbell" | "x" | "database"
  | "music" | "musicNote" | "server" | "chevronupdown" | "sparkles" | "badgecheck" | "creditcard" | "bell" |
  "logout" | "gear" | "user" | "login" | "stickynote" | "google" | 'image' | 'volume2' | 'mic' | 'micOff' | 'video' |
  "archive" | "archive-restore" | "clock" | "calendar" | "file-clock" | "file-plus" | "plus" | "file" | "square-check"
  | "edit" | "check" | "trash-2" | "loader" | "layout-grid" | "play" | "refresh-cw" | "mouse-pointer" | "triangle-alert" |
  "circle-x" | "circle" | "check-circle" | "upload" | "share" | "copy" | "users" | "chevron-down" | "download" | "move" | "arrow-down" | "message-circle" | "bot" | "send" | "chevron-up" | "loader-2" | "link" | "paperclip" | "search" | "search-x" | "folder" | "file-code" | "braces" | "file-text" | "bug";

// Define props for the Icon component
// We want to accept any standard SVG element attributes
type IconProps = {
  name: IconName;
} & ComponentProps<"svg">; // Allows passing standard SVG props like class, width, height, etc.

// Individual SVG components (or direct JSX)
const DownloadIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download" {...props}><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></svg>);

const LoaderIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-icon lucide-loader" {...props}><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" /></svg>)

const Trash2Icon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2" {...props}><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
)

const ImageIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image" {...props}><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
)

const GoogleIcon = (props: ComponentProps<"svg">) => (
  <svg width="256" height="262" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" {...props}><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4" /><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853" /><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05" /><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335" /></svg>
)

const PanelLeftIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

const PanelLeftCloseIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </svg>
);

const HouseIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const DumbbellIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
    <path d="m2.5 21.5 1.4-1.4" />
    <path d="m20.1 3.9 1.4-1.4" />
    <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
    <path d="m9.6 14.4 4.8-4.8" />
  </svg>
);



const XIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x" {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

const DatabaseIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M12 22V12" />
    <path d="M12 2v10" />
  </svg>
);

const MusicIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const MusicNoteIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
  </svg>
);

const ServerIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="6" y2="6" />
    <line x1="6" x2="6.01" y1="18" y2="18" />
  </svg>
);

const ChevronUpDownIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-up-down-icon lucide-chevrons-up-down" {...props}>
    <path d="m7 15 5 5 5-5" />
    <path d="m7 9 5-5 5 5" />
  </svg>
);

const SparklesIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles-icon lucide-sparkles" {...props}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </svg>
);

const BadgeCheckIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-badge-check-icon lucide-badge-check" {...props}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CreditCardIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-credit-card-icon lucide-credit-card" {...props}>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const BellIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell-icon lucide-bell" {...props}>
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
);

const LogoutIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out-icon lucide-log-out" {...props}>
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </svg>
);

const GearIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings" {...props}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user" {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LoginIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-in" {...props}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" x2="3" y1="12" y2="12" />
  </svg>
);

const StickyNoteIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sticky-note-icon lucide-sticky-note" {...props}>
    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
    <path d="M15 3v4a2 2 0 0 0 2 2h4" />
  </svg>
);

const ArchiveIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-archive" {...props}><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>
);

const ArchiveRestoreIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-archive-restore" {...props}><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M9 13h6" /><path d="M12 10v6" /></svg>
);

const ClockIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CalendarIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const FileClockIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M16 22h2a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <circle cx="8" cy="16" r="6" />
    <path d="M9.5 17.5 8 16.25V14" />
  </svg>
);

const FilePlusIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M9 15h6" />
    <path d="M12 18v-6" />
  </svg>
);

const PlusIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const MicIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
);

const MicOffIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}><line x1="2" x2="22" y1="2" y2="22" /><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" /><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M12 19v3" /><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 .84 2.15" /><path d="M8.63 8.61A3 3 0 0 1 9 5V2" /></svg>
);

const VideoIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}><path d="M2 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M18 9l4-2v8l-4-2v-4z" /></svg>
);

const Volume2Icon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2" {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const FileIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-icon lucide-file" {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
);

const SquareCheckIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-check-icon lucide-square-check" {...props}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 12 2 2 4-4" /></svg>
);

const EditIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LayoutGridIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

const PlayIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const RefreshCwIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const MousePointerIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="M13 13l6 6" />
  </svg>
);

const TriangleAlertIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert" {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const CircleXIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-x" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

const CircleIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const CheckCircleIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const UploadIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 5 17 10" />
    <line x1="12" x2="12" y1="5" y2="15" />
  </svg>
);

const ShareIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684 6.632 3.316m-6.632-6 6.632-3.316m0 0a3 3 0 1 1 5.367-2.684 3 3 0 0 1-5.367 2.684zm0 9.316a3 3 0 1 1 5.367 2.684 3 3 0 0 1-5.367-2.684z" />
  </svg>
);

const CopyIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const UsersIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m22 21-3.5-3.5" />
    <path d="m17 17 5 5" />
    <circle cx="20" cy="8" r="3" />
  </svg>
);

const ChevronDownIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const MoveIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move" {...props}>
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="22" />
  </svg>
);

const ArrowDownIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down" {...props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);

const MessageCircleIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon lucide-message-circle" {...props}><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
);

const BotIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

const SendIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);

const ChevronUpIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="m18 15-6-6-6 6" />
  </svg>
);

const Loader2Icon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const LinkIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const PaperclipIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const SearchIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const SearchXIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="m13.5 8.5-5 5" />
    <path d="m8.5 8.5 5 5" />
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const FolderIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

const FileCodeIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 13 2 2-2 2" />
  </svg>
);

const BracesIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
    <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
  </svg>
);

const FileTextIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);

const BugIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bug-icon lucide-bug" {...props}>
    <path d="m8 2 1.88 1.88" />
    <path d="M14.12 3.88 16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
    <path d="M12 20v-9" />
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
    <path d="M6 13H2" />
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
    <path d="M22 13h-4" />
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </svg>
);

export const Icon = (props: IconProps) => {
  const [local, others] = splitProps(props, ["name", "class", "width", "height"]);

  const defaultWidth = local.width || "24";
  const defaultHeight = local.height || "24";
  const defaultClass = local.class || "lucide"; // Default class if none provided

  return (
    <Switch fallback={<Show when={import.meta.env.DEV}><p>Icon not found: {local.name}</p></Show>}>
      <Match when={local.name === "download"}>
        <DownloadIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "loader"}>
        <LoaderIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "trash-2"}>
        <Trash2Icon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "square-check"}>
        <SquareCheckIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "file"}>
        <FileIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "image"}>
        <ImageIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "google"}>
        <GoogleIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "panelLeft"}>
        <PanelLeftIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "panelLeftClose"}>
        <PanelLeftCloseIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "house"}>
        <HouseIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "dumbbell"}>
        <DumbbellIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>

      <Match when={local.name === "x"}>
        <XIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "database"}>
        <DatabaseIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "music"}>
        <MusicIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "musicNote"}>
        <MusicNoteIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "server"}>
        <ServerIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "chevronupdown"}>
        <ChevronUpDownIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "sparkles"}>
        <SparklesIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "badgecheck"}>
        <BadgeCheckIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "creditcard"}>
        <CreditCardIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "bell"}>
        <BellIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "logout"}>
        <LogoutIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "gear"}>
        <GearIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "user"}>
        <UserIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "login"}>
        <LoginIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "stickynote"}>
        <StickyNoteIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "archive"}>
        <ArchiveIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "archive-restore"}>
        <ArchiveRestoreIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "clock"}>
        <ClockIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "calendar"}>
        <CalendarIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "file-clock"}>
        <FileClockIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "file-plus"}>
        <FilePlusIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "plus"}>
        <PlusIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "mic"}>
        <MicIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "micOff"}>
        <MicOffIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "volume2"}>
        <Volume2Icon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "video"}>
        <VideoIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "edit"}>
        <EditIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "check"}>
        <CheckIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "layout-grid"}>
        <LayoutGridIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "play"}>
        <PlayIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "refresh-cw"}>
        <RefreshCwIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "mouse-pointer"}>
        <MousePointerIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "triangle-alert"}>
        <TriangleAlertIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "circle-x"}>
        <CircleXIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "circle"}>
        <CircleIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "check-circle"}>
        <CheckCircleIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "upload"}>
        <UploadIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "share"}>
        <ShareIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "copy"}>
        <CopyIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "users"}>
        <UsersIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "chevron-down"}>
        <ChevronDownIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "move"}>
        <MoveIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "arrow-down"}>
        <ArrowDownIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "message-circle"}>
        <MessageCircleIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "bot"}>
        <BotIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "send"}>
        <SendIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "chevron-up"}>
        <ChevronUpIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "loader-2"}>
        <Loader2Icon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "link"}>
        <LinkIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "paperclip"}>
        <PaperclipIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "search"}>
        <SearchIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "search-x"}>
        <SearchXIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "folder"}>
        <FolderIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "file-code"}>
        <FileCodeIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "braces"}>
        <BracesIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "file-text"}>
        <FileTextIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "bug"}>
        <BugIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
    </Switch>
  );
};
