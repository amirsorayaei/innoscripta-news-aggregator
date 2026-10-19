// Realistic response structures with synthetic article content.

export function guardianResult(n: number, overrides: object = {}) {
  return {
    id: `business/2026/oct/19/synthetic-story-${n}`,
    type: 'article',
    sectionId: 'business',
    sectionName: 'Business',
    webPublicationDate: `2026-10-19T0${n % 10}:15:00Z`,
    webTitle: `Synthetic business story ${n}`,
    webUrl: `https://www.theguardian.com/business/2026/oct/19/synthetic-story-${n}`,
    apiUrl: `https://content.guardianapis.com/business/2026/oct/19/synthetic-story-${n}`,
    fields: {
      trailText: `<p>Summary for <strong>story ${n}</strong></p>`,
      thumbnail: `https://media.guim.co.uk/synthetic/${n}/500.jpg`,
      byline: 'Jane Doe and John Smith',
    },
    tags: [
      { id: 'business/business', type: 'keyword', webTitle: 'Business' },
      { id: 'profile/jane-doe', type: 'contributor', webTitle: 'Jane Doe' },
    ],
    isHosted: false,
    pillarId: 'pillar/news',
    pillarName: 'News',
    ...overrides,
  }
}

export function guardianResponse(results: unknown[], page = 1, pages = 3) {
  return {
    response: {
      status: 'ok',
      userTier: 'developer',
      total: pages * 10,
      startIndex: (page - 1) * 10 + 1,
      pageSize: 10,
      currentPage: page,
      pages,
      orderBy: 'newest',
      results,
    },
  }
}

/** Current Article Search document shape (object multimedia, byline.original). */
export function nytDoc(n: number, overrides: object = {}) {
  return {
    abstract: `Abstract for synthetic story ${n}.`,
    byline: { original: 'By Jane Doe and John Smith' },
    document_type: 'article',
    headline: {
      main: `Synthetic technology story ${n}`,
      kicker: '',
      print_headline: '',
    },
    _id: `nyt://article/synthetic-${n}`,
    keywords: [],
    multimedia: {
      caption: 'Synthetic caption.',
      credit: 'Synthetic Credit',
      default: {
        url: `https://static01.nyt.com/images/2026/10/19/synthetic-${n}.jpg`,
        height: 400,
        width: 600,
      },
      thumbnail: {
        url: `https://static01.nyt.com/images/2026/10/19/synthetic-${n}-thumb.jpg`,
        height: 75,
        width: 75,
      },
    },
    news_desk: 'Business',
    pub_date: '2026-10-19T08:00:05Z',
    section_name: 'Technology',
    snippet: `Snippet for synthetic story ${n}.`,
    source: 'The New York Times',
    subsection_name: '',
    type_of_material: 'News',
    uri: `nyt://article/synthetic-${n}`,
    web_url: `https://www.nytimes.com/2026/10/19/technology/synthetic-${n}.html`,
    word_count: 900,
    ...overrides,
  }
}

/** Older Article Search shape (array multimedia, byline.person). */
export function nytLegacyDoc(n: number) {
  return {
    ...nytDoc(n),
    byline: {
      original: 'By Jane Doe',
      person: [
        {
          firstname: 'Jane',
          middlename: 'Q.',
          lastname: 'Doe',
          role: 'reported',
        },
      ],
    },
    multimedia: [
      { url: `images/2026/10/19/legacy-${n}-thumb.jpg`, subtype: 'thumbnail' },
      { url: `images/2026/10/19/legacy-${n}.jpg`, subtype: 'xlarge' },
    ],
    pub_date: '2026-10-19T08:00:05+0000',
  }
}

export function nytResponse(docs: unknown[], offset = 0, hits = 25) {
  return {
    status: 'OK',
    copyright:
      'Copyright (c) 2026 The New York Times Company. All Rights Reserved.',
    response: { docs, meta: { hits, offset, time: 12 } },
  }
}

export function newsApiArticle(n: number, overrides: object = {}) {
  return {
    source: { id: 'techcrunch', name: 'TechCrunch' },
    author: 'By Jane Doe, John Smith',
    title: `Synthetic gadget story ${n}`,
    description: `Description for <b>synthetic</b> story ${n}.`,
    url: `https://techcrunch.com/2026/10/19/synthetic-${n}/?utm_source=newsapi`,
    urlToImage: `https://techcrunch.com/wp-content/uploads/synthetic-${n}.jpg`,
    publishedAt: '2026-10-19T07:45:00Z',
    content: 'Synthetic content… [+1200 chars]',
    ...overrides,
  }
}

export function newsApiResponse(articles: unknown[], totalResults = 25) {
  return { status: 'ok', totalResults, articles }
}
