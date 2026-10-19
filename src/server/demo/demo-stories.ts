import type { Category } from '../../shared/categories.js'

/** Fictional stories for Demo mode. None describe real events or people. */
export const demoStories: Record<Category, [title: string, summary: string][]> =
  {
    general: [
      [
        'Coastal towns trial shared flood barriers ahead of winter storms',
        'Five neighbouring councils are pooling equipment and volunteers to protect harbour roads.',
      ],
      [
        'City council votes to extend late-night bus routes',
        'The pilot adds four routes linking hospitals, campuses and the central station.',
      ],
      [
        'Regional election turnout rises as postal voting expands',
        'Officials credit simpler forms and longer return windows for the increase.',
      ],
      [
        'Libraries add evening study halls during exam season',
        'Branches across the county will stay open until 10pm on weekdays.',
      ],
      [
        'Border towns agree joint plan for wildfire evacuation drills',
        'Emergency services will rehearse cross-border routes twice a year.',
      ],
      [
        'Volunteer network maps safe walking routes for schoolchildren',
        'Parents surveyed more than 300 crossings to flag missing signals.',
      ],
      [
        'Rail operators publish a single timetable for three regions',
        'Passengers can now plan connections across previously separate networks.',
      ],
    ],
    business: [
      [
        'Small exporters turn to shared warehouses to cut shipping costs',
        'Co-operative storage lets firms combine orders and negotiate lower rates.',
      ],
      [
        'Grocery chain tests refill stations in twelve stores',
        'Customers bring their own containers for grains, oils and detergents.',
      ],
      [
        'Regional bank launches fee-free accounts for apprentices',
        'The accounts include budgeting tools and no overdraft charges.',
      ],
      [
        'Furniture makers report a rise in repair-and-return orders',
        'Workshops say customers increasingly restore pieces instead of replacing them.',
      ],
      [
        'Startup funding shifts toward climate and energy storage',
        'Investors favoured hardware companies with signed pilot customers.',
      ],
      [
        'Port authority approves electric cranes for container terminal',
        'The upgrade is expected to cut diesel use at the docks by half.',
      ],
      [
        'Independent bookshops form buying group to compete on price',
        'Forty shops will negotiate jointly with distributors from next spring.',
      ],
    ],
    technology: [
      [
        'Open-source AI model runs speech recognition fully offline',
        'Developers say the small model fits on mid-range phones without a network.',
      ],
      [
        'Browser makers agree on a common format for saved passwords',
        'Users will be able to move credentials between browsers in one step.',
      ],
      [
        'Repair-friendly laptop design lets owners swap batteries in minutes',
        'The modular chassis uses standard screws and labelled parts.',
      ],
      [
        'City network replaces streetlight sensors with low-power radios',
        'Engineers expect the batteries to last a decade between changes.',
      ],
      [
        'Developers adopt passkeys for internal tools after phishing tests',
        'The change removed passwords for most staff accounts within a month.',
      ],
      [
        'Satellite internet trial connects mountain clinics',
        'Doctors can now upload scans the same day instead of driving them out.',
      ],
      [
        'Researchers publish dataset to test accessibility of mobile apps',
        'The benchmark covers screen readers, contrast and touch target size.',
      ],
    ],
    science: [
      [
        'Deep-sea survey records dozens of unnamed species near ridge vents',
        'Scientists will spend months matching samples with existing collections.',
      ],
      [
        'Astronomers detect water vapour on a distant rocky planet',
        'Follow-up observations are planned to rule out instrument artefacts.',
      ],
      [
        'Restored wetlands store more carbon than expected, study finds',
        'Researchers measured soil cores across seven restored sites.',
      ],
      [
        'Glacier melt is reshaping river channels downstream, models show',
        'The study combines satellite images with field measurements.',
      ],
      [
        'Citizen scientists help track migrating butterflies across continents',
        'Thousands of volunteers logged sightings through a free app.',
      ],
      [
        'New telescope camera captures faint galaxies in a single night',
        'The detector is four times more sensitive than its predecessor.',
      ],
      [
        'Seed bank expands collection of drought-resistant crops',
        'Samples from 30 regions were added to the long-term vault.',
      ],
    ],
    health: [
      [
        'Community clinics extend vaccination hours for working families',
        'Evening and weekend appointments will run through the winter season.',
      ],
      [
        'Study links regular walking groups to better sleep in older adults',
        'Participants reported fewer night-time awakenings after twelve weeks.',
      ],
      [
        'Hospitals pilot text reminders to reduce missed appointments',
        'Early results show a drop in no-shows at outpatient departments.',
      ],
      [
        'School meal programme adds more fresh vegetables to menus',
        'Nutritionists worked with cooks to keep costs within budget.',
      ],
      [
        'Mental health helpline expands to cover rural areas overnight',
        'Trained volunteers will answer calls from 10pm to 6am.',
      ],
      [
        'Pharmacists gain new role in managing blood pressure checks',
        'Patients can book free checks without a doctor’s referral.',
      ],
      [
        'Researchers test app that coaches patients after knee surgery',
        'The trial compares app-guided exercise with standard physiotherapy.',
      ],
    ],
    sports: [
      [
        'Underdog club secures promotion on final day of the season',
        'A late equaliser was enough to lift the team into the top flight.',
      ],
      [
        'City marathon adds wheelchair division with equal prize money',
        'Organisers say the change follows years of athlete campaigning.',
      ],
      [
        'Youth cricket league doubles number of girls’ teams',
        'Coaches credit free kit and after-school sessions for the growth.',
      ],
      [
        'Cycling federation unveils safer sprint finish rules',
        'Barriers and wider final straights will be required at all races.',
      ],
      [
        'Veteran goalkeeper announces retirement after 18 seasons',
        'The keeper made more than 500 league appearances for one club.',
      ],
      [
        'Swimming pool reopens with accessible changing rooms',
        'The refurbishment added hoists, wider lanes and quieter sessions.',
      ],
      [
        'Basketball academy partners with schools to train referees',
        'Students can earn certification while officiating junior games.',
      ],
    ],
    entertainment: [
      [
        'Indie film about a lighthouse keeper wins festival audience award',
        'The first-time director shot the film over two winters on a small island.',
      ],
      [
        'Museum reopens with interactive gallery on the history of music',
        'Visitors can mix their own tracks using restored studio equipment.',
      ],
      [
        'Long-running radio drama records its 5,000th episode',
        'Cast members past and present returned for a live anniversary show.',
      ],
      [
        'Animation studio opens free workshops for teenage storytellers',
        'Participants will produce a short film over six weekends.',
      ],
      [
        'Theatre company tours village halls with a new comedy',
        'The production travels with a portable stage and solar lighting.',
      ],
      [
        'Video game about restoring a coral reef tops download charts',
        'Players repair habitats while learning about marine ecosystems.',
      ],
      [
        'Orchestra streams rehearsals to raise interest in classical music',
        'Viewers can ask musicians questions during the breaks.',
      ],
    ],
  }
