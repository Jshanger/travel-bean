import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";

export const places = pgTable("places", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  city: text("city"),
  category: text("category").notNull(),
  dateVisited: text("date_visited").notNull(),
  notes: text("notes").notNull().default(""),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  placeName: text("place_name").notNull(),
  date: text("date").notNull(),
  rating: integer("rating").notNull().default(5),
  companions: text("companions").notNull().default(""),
  favouriteMoment: text("favourite_moment").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bucketItems = pgTable("bucket_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  country: text("country"),
  source: text("source").notNull(),
  tags: jsonb("tags").notNull().default([]),
  status: text("status").notNull(),
  notes: text("notes").notNull().default(""),
  imageUrl: text("image_url"),
  imageObjectPath: text("image_object_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const placePhotos = pgTable("place_photos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  placeId: text("place_id").notNull(),
  objectPath: text("object_path").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull().default(0),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  userId: text("user_id").primaryKey(),
  isPro: boolean("is_pro").notNull().default(false),
  proSince: timestamp("pro_since"),
  proUntil: timestamp("pro_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  imageUrl: text("image_url"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const placeVoiceNotes = pgTable("place_voice_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  placeId: text("place_id").notNull(),
  objectPath: text("object_path").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trips = pgTable("trips", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  travellers: jsonb("travellers").notNull().default([]),
  itinerary: jsonb("itinerary").notNull().default([]),
  shareId: text("share_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const travelBlogSettings = pgTable("travel_blog_settings", {
  userId: text("user_id").primaryKey(),
  username: text("username").notNull(),
  title: text("title").notNull(),
  intro: text("intro").notNull().default(""),
  privacy: text("privacy").notNull().default("private"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourcePlaceId: text("source_place_id").notNull(),
  status: text("status").notNull().default("draft"),
  privacy: text("privacy").notNull().default("private"),
  password: text("password"),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  opening: text("opening").notNull().default(""),
  body: text("body").notNull().default(""),
  coverPhotoId: text("cover_photo_id"),
  coverImageUrl: text("cover_image_url"),
  photos: jsonb("photos").notNull().default([]),
  place: text("place").notNull(),
  country: text("country").notNull(),
  city: text("city"),
  dateVisited: text("date_visited").notNull().default(""),
  category: text("category").notNull().default("Travel"),
  tags: jsonb("tags").notNull().default([]),
  hideExactLocation: boolean("hide_exact_location").notNull().default(false),
  hideDate: boolean("hide_date").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});
