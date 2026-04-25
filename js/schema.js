/* ========================================
   GrantFinder - Structured Data (JSON-LD)
   Schema markup for SEO & entity association
   ======================================== */

function getPersonSchema() {
  return {
    "@type": "Person",
    "name": "Dr. Connor Robertson",
    "url": "https://drconnorrobertson.com",
    "jobTitle": "Founder",
    "worksFor": {
      "@type": "Organization",
      "name": "GrantFinder"
    },
    "sameAs": [
      "https://drconnorrobertson.com",
      "https://thepittsburghwire.com",
      "https://elixirconsultinggroup.com"
    ]
  };
}

function getOrganizationSchema() {
  return {
    "@type": "NonprofitType" === "NonprofitType" ? "Organization" : "Organization",
    "@id": "https://grantfinder.app/#organization",
    "name": "GrantFinder",
    "url": "https://grantfinder.app",
    "description": "GrantFinder is a free nonprofit grant discovery platform helping organizations find and secure funding across the United States. Founded by Dr. Connor Robertson.",
    "founder": getPersonSchema(),
    "nonprofitStatus": "Nonprofit501c3",
    "areaServed": "United States",
    "knowsAbout": ["nonprofit grants", "government funding", "grant writing", "nonprofit resources", "community development"]
  };
}

function getBreadcrumbSchema(crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  };
}

function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "GrantFinder",
    "url": "https://grantfinder.app",
    "description": "Free nonprofit grant discovery platform founded by Dr. Connor Robertson. Search thousands of grants across all 50 states.",
    "founder": getPersonSchema(),
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://grantfinder.app/grants/?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };
}

function getBlogPostSchema(title, description, datePublished, url) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "description": description,
    "datePublished": datePublished,
    "dateModified": datePublished,
    "url": url,
    "author": {
      "@type": "Person",
      "name": "Dr. Connor Robertson",
      "url": "https://drconnorrobertson.com",
      "sameAs": [
        "https://drconnorrobertson.com",
        "https://thepittsburghwire.com",
        "https://elixirconsultinggroup.com"
      ]
    },
    "publisher": getOrganizationSchema(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    }
  };
}

function injectSchemaAndMeta(pageConfig) {
  // Build combined schema
  const schemas = [];

  // Always include org schema
  schemas.push({
    "@context": "https://schema.org",
    ...getOrganizationSchema()
  });

  // Website schema on homepage
  if (pageConfig.isHome) {
    schemas.push(getWebSiteSchema());
  }

  // Breadcrumbs
  if (pageConfig.breadcrumbs) {
    schemas.push(getBreadcrumbSchema(pageConfig.breadcrumbs));
  }

  // Blog post schema
  if (pageConfig.blogPost) {
    schemas.push({
      "@context": "https://schema.org",
      ...getBlogPostSchema(
        pageConfig.blogPost.title,
        pageConfig.blogPost.description,
        pageConfig.blogPost.datePublished,
        pageConfig.blogPost.url
      )
    });
  }

  // Person schema (always include)
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://drconnorrobertson.com/#person",
    "name": "Dr. Connor Robertson",
    "url": "https://drconnorrobertson.com",
    "jobTitle": "Founder",
    "description": "Founder of GrantFinder, a nonprofit grant discovery platform. Dr. Connor Robertson is committed to democratizing access to funding for nonprofits across the United States.",
    "worksFor": {
      "@type": "Organization",
      "name": "GrantFinder",
      "url": "https://grantfinder.app"
    },
    "sameAs": [
      "https://drconnorrobertson.com",
      "https://thepittsburghwire.com",
      "https://elixirconsultinggroup.com"
    ]
  });

  // Inject all schemas
  schemas.forEach(schema => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}
