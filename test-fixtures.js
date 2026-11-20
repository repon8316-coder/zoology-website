// Fake data shaped exactly like the JSON contracts of migration 64 (web_site_head, web_site_routine*, web_site_museum*, web_site_library*).
// Used by test.js (pure helpers) and test-dom.js (page smoke test). Fake names only.
"use strict";

const TODAY = "2026-11-22";            // a Sunday (ISO 7); Sunday is the first working day
const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";

const batches = {
  maintenance: false, enabled: true,
  batches: [
    { id: B1, program: "BSc (Hons)", program_bn: "বি.এস.সি. (সম্মান)", session: "2025-26", year_of_study: 1 },
    { id: B2, program: "BSc (Hons)", program_bn: "বি.এস.সি. (সম্মান)", session: "2024-25", year_of_study: 2 },
    { id: "33333333-3333-4333-8333-333333333333", program: "Degree (Pass)", program_bn: null, session: "2025-26", year_of_study: 1 }
  ]
};

const routine = {
  maintenance: false, enabled: true, today: TODAY, now_period: 2, working_days: [7, 1, 2, 3, 4],
  periods: [{ period_no: 2, start: "09:50", end: "10:40" }, { period_no: 1, start: "09:00", end: "09:50" }, { period_no: 3, start: "10:50", end: "11:40" }],
  slots: [
    { day: 7, period_no: 1, subject_code: "ZOO-101", subject_name_bn: "প্রাণিবিদ্যা পরিচিতি", subject_name_en: "Intro", class_type: "theory", teacher_name: "ড. রহিম উদ্দিন", room: "২০১" },
    { day: 7, period_no: 2, subject_code: "ZOO-102", subject_name_bn: "কর্ডাটা", subject_name_en: "Chordata", class_type: "theory", teacher_name: "মিসেস করিম", room: "২০১" },
    { day: 7, period_no: 2, subject_code: "ZOO-103P", subject_name_bn: "ব্যবহারিক পরীক্ষণ", subject_name_en: "Practical", class_type: "practical", teacher_name: "জনাব সেলিম", room: "ল্যাব ১" },
    { day: 1, period_no: 1, subject_code: "ZOO-101", subject_name_bn: "প্রাণিবিদ্যা পরিচিতি", subject_name_en: "Intro", class_type: "theory", teacher_name: "ড. রহিম উদ্দিন", room: "২০১" },
    { day: 2, period_no: 3, subject_code: "ZOO-104", subject_name_bn: "কীটতত্ত্ব", subject_name_en: "Entomology", class_type: "theory", teacher_name: "জনাব সেলিম", room: "২০২" }
  ],
  exceptions: [
    { on_date: TODAY, day: 7, period_no: 1, kind: "cancelled", subject_code: "ZOO-101", teacher_name: "ড. রহিম উদ্দিন", substitute_name: null },
    { on_date: TODAY, day: 7, period_no: 2, kind: "substitute", subject_code: "ZOO-102", teacher_name: "মিসেস করিম", substitute_name: "জনাব হাসান" },
    { on_date: "2026-11-23", day: 1, period_no: 1, kind: "cancelled", subject_code: "ZOO-101", teacher_name: "ড. রহিম উদ্দিন", substitute_name: null },
    { on_date: "2026-11-29", day: 7, period_no: 1, kind: "cancelled", subject_code: "ZOO-101", teacher_name: "ড. রহিম উদ্দিন", substitute_name: null }
  ]
};

const head = {
  maintenance: false, enabled: true,
  person: { id: "p1", kind: "teacher", name: "ড. আব্দুল করিম", designation: "অধ্যাপক ও বিভাগীয় প্রধান", bio: null, photo_path: null, email_public: "head@example.com" },
  message: { title: "বিভাগীয় প্রধানের বাণী", updated_at: "2026-11-01T10:00:00Z",
    body_md: "প্রিয় শিক্ষার্থীবৃন্দ,\n\n**প্রাণিবিদ্যা** বিভাগে তোমাদের স্বাগত। " + "প্রকৃতিকে জানা আমাদের কাজ। ".repeat(30) + "\n\n- একটি তালিকা" }
};

const museumItems = [1, 2, 3, 4].map((n) => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-00000000000" + n, title_bn: "নমুনা " + n, title_en: "Specimen " + n, scientific_name: "Rana tigrina " + n,
  category: n % 2 ? "উভচর" : "সরীসৃপ", catalog_no: "MUS-00" + n, photo_path: n === 1 ? "museum/202611/a-b.jpg" : null, excerpt: "সংক্ষিপ্ত বর্ণনা"
}));
const museum = { maintenance: false, total: 4, categories: ["উভচর", "সরীসৃপ"], items: museumItems };
const museumItem = { maintenance: false, item: Object.assign({}, museumItems[0], { description: "প্রথম লাইন\n\nদ্বিতীয় অনুচ্ছেদ", collected_from: "তিস্তা নদীর চর", collected_on: "2025-03-05" }) };

const libItems = Array.from({ length: 20 }, (_, i) => ({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-0000000000" + (10 + i), title: "প্রাণিবিদ্যা বই " + (i + 1), author: "লেখক " + (i + 1), category: "পাঠ্যবই",
  publisher: "প্রকাশনী", edition_year: 2015, accession_no: "ACC-" + (i + 1), shelf: "A-1", copies: 2, note: null
}));
const library = { maintenance: false, total: 45, items: libItems };
const libraryCategories = { maintenance: false, categories: [{ category: "পাঠ্যবই", count: 30 }, { category: "জার্নাল", count: 15 }] };

const home = {
  notices: [{ id: "n1", title: "ভর্তি বিজ্ঞপ্তি", publish_at: "2026-11-20T04:00:00Z", pinned: true, category: "ভর্তি", excerpt: "সংক্ষেপ", has_attachment: false },
    { id: "n2", title: "পরীক্ষার সূচি", publish_at: "2026-11-18T04:00:00Z", pinned: false, category: null, excerpt: null, has_attachment: true }],
  people: [{ id: "p1", kind: "teacher", name: "ড. আব্দুল করিম", designation: "অধ্যাপক", photo_path: null, email_public: null, bio: null }]
};
const gallery = { albums: [], items: [1, 2].map((n) => ({ id: "g" + n, title: "ছবি " + n, caption: null, album: null, image_path: "gallery/202611/g" + n + "-x.jpg" })) };
const settings = { maintenance: false, name_bn: "প্রাণিবিদ্যা বিভাগ", name_en: "Department of Zoology", college_bn: "রংপুর সরকারি কলেজ, রংপুর", address: "রংপুর", phone: "01700000000", email: "zoo@example.com" };
const pageMuseum = { item: { slug: "museum", title: "মিউজিয়াম", body_md: "আমাদের মিউজিয়ামে **নমুনা** সংরক্ষিত আছে।" } };
const pageLibrary = { item: { slug: "seminar-library", title: "সেমিনার লাইব্রেরি", body_md: "খোলা থাকে: রবি–বৃহস্পতি, সকাল ১০টা থেকে বিকেল ৪টা।" } };

module.exports = { TODAY, B1, B2, batches, routine, head, museum, museumItem, library, libraryCategories, home, gallery, settings, pageMuseum, pageLibrary };
