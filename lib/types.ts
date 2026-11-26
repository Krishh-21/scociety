export type DealStatus =
  | "pending"
  | "open"
  | "locked"
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled";

export type Slab = { minFlats: number; pricePaise: number };

export type JobStatus = "scheduled" | "en_route" | "in_progress" | "completed";

export type RevisitVisit = {
  id: string;
  disputeId: string;
  dealId: string;
  memberId: string;
  vendorId: string;
  vendorName: string;
  residentId: string;
  residentName: string;
  serviceName: string;
  societyName: string;
  flat: string;
  reason: string;
  detail: string;
  instructions: string;
  status: "awaiting_schedule" | "scheduled" | "in_progress" | "completed";
  serviceDate: string | null;
  slot: string;
  technician: string;
  startOtp: string;
  endOtp: string;
  finishedAt: string | null;
};

export type Society = {
  id: string;
  name: string;
  locality: string;
  city: string;
  flatCount: number;
  approvalRequired: 0 | 1;
};

export type User = {
  id: string;
  phone: string;
  name: string;
  role: "resident" | "secretary" | "vendor" | "ops" | "guard";
  vendorId: string | null;
  lang: "en" | "hi";
};

export type Residency = {
  id: string;
  userId: string;
  societyId: string;
  flat: string;
  type: "owner" | "tenant";
  status: "pending" | "verified" | "rejected" | "revoked";
};

export type Sku = {
  id: string;
  category: string;
  name: string;
  unit: string;
  unitLabel: string;
  listPricePaise: number;
  durationMin: number;
  included: string[];
  excluded: string[];
  warrantyDays: number;
  mvsDefault: number;
  season: string;
  /** Does the price ladder count joining flats, or the units they bring (ACs, cars)? */
  ladderBasis: "flats" | "units";
  /** How many units one crew can serve in a two-hour slot. */
  unitsPerSlot: number;
  /** 0 = one-off; otherwise how often a society comes back to it. */
  repeatMonths: number;
};

export type Vendor = {
  id: string;
  name: string;
  rating: number;
  jobsDone: number;
  badges: string[];
  city: string;
  /** The services this vendor does. A group can only be given to a vendor that offers its service. */
  skuIds: string[];
};

export type Deal = {
  id: string;
  societyId: string;
  skuId: string;
  vendorId: string;
  createdBy: string;
  serviceDate: string; // ISO date
  slotWindows: string[];
  status: DealStatus;
  joinDeadline: string; // ISO datetime
  targetFlats: number;
  mvs: number;
  listPricePaise: number;
  slabs: Slab[];
  createdAt: string;
  lockedAt: string | null;
  /** Lowest price ever reached while open; never given back. */
  floorPricePaise: number | null;
  /** Set once when a close group gets its one automatic 48h extension. */
  extendedAt: string | null;
  /** Committee member who let it go live, in societies that require approval. */
  approvedBy: string | null;
};

export type DealMember = {
  id: string;
  dealId: string;
  userId: string;
  flat: string;
  units: number;
  slot: string;
  paymentMethod: "upi" | "card" | "cash";
  status: "joined" | "left" | "locked" | "served";
  finalPricePaise: number | null;
  joinedAt: string;
};

export type DealView = Deal & {
  sku: Sku;
  vendor: Vendor;
  society: Society;
  flatsJoined: number;
  unitsJoined: number;
  /** What the ladder counts for this deal: flats, or units. */
  basis: "flats" | "units";
  basisCount: number;
  basisLabel: string;
  /** What the slab table alone would charge at the current count. */
  slabPricePaise: number;
  /** The price actually charged: never above the floor this deal has already reached. */
  currentPricePaise: number;
  /** True when members left and the slab price would otherwise have gone back up. */
  priceHeld: boolean;
  nextSlab: { away: number; pricePaise: number } | null;
  savingsPaise: number;
  /** Capacity per service slot, so a crew is never over-booked. */
  slotLoad: { slot: string; used: number; capacity: number; full: boolean }[];
  members: (DealMember & { name: string })[];
  comments: { id: string; name: string; flat: string; body: string; at: string }[];
  joinedByMe: DealMember | null;
  msToDeadline: number;
};
