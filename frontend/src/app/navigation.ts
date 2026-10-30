import {
  BookOpenCheck,
  ChartNoAxesCombined,
  LayoutDashboard,
  Network,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  keywords: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Command",
    items: [
      {
        label: "Overview",
        href: "/",
        icon: LayoutDashboard,
        description: "Security command center and posture summary.",
        keywords: ["dashboard", "home", "posture", "metrics"],
      },
      {
        label: "AI Copilot",
        href: "/copilot",
        icon: Sparkles,
        description: "Grounded security knowledge and event investigation.",
        keywords: ["chat", "assistant", "rag", "question", "agent"],
      },
    ],
  },
  {
    label: "Monitor",
    items: [
      {
        label: "Identity Monitoring",
        href: "/identities",
        icon: Users,
        description: "Directory, risk posture and recent authentication records.",
        keywords: ["users", "directory", "profiles", "identities"],
      },
      {
        label: "Threat Intelligence",
        href: "/threats",
        icon: Network,
        description: "Identity-country relationships and priority signals.",
        keywords: ["graph", "network", "3d", "countries", "threats"],
      },
      {
        label: "Risk Analysis",
        href: "/risk",
        icon: ScanSearch,
        description: "Run an access event through rules, ML and SHAP.",
        keywords: ["analyze", "shap", "ml", "score", "event"],
      },
    ],
  },
  {
    label: "Respond",
    items: [
      {
        label: "Incident Review",
        href: "/incidents",
        icon: ShieldCheck,
        description: "Human review queue and decision audit history.",
        keywords: ["review", "approve", "escalate", "human"],
      },
      {
        label: "Security Playbooks",
        href: "/playbooks",
        icon: BookOpenCheck,
        description: "Search local security procedures and evidence.",
        keywords: ["knowledge", "rag", "documents", "procedures"],
      },
      {
        label: "Analytics",
        href: "/analytics",
        icon: ChartNoAxesCombined,
        description: "Dataset trends, signal distribution and model metrics.",
        keywords: ["charts", "metrics", "model", "reports"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings2,
        description: "Session, visualization preferences and data provenance.",
        keywords: ["preferences", "reduced motion", "3d", "account"],
      },
    ],
  },
];

export const flatNavigation = navigation.flatMap((group) => group.items);
