
#import "@preview/fontawesome:0.6.0": *
#let stringify-by-func(it) = {
  let func = it.func()
  return if func in (parbreak, pagebreak, linebreak) {
    "\n"
  } else if func == smartquote {
    if it.double { "\"" } else { "'" }
  } else if it.fields() == (:) {
    ""
  } else {
    panic("Not sure how to handle type `" + repr(func) + "`")
  }
}

#let plain-text(it) = {
  return if type(it) == str {
    it
  } else if it == [ ] {
    " "
  } else if it.has("children") {
    it.children.map(plain-text).join()
  } else if it.has("body") {
    plain-text(it.body)
  } else if it.has("text") {
    if type(it.text) == str { it.text } else { plain-text(it.text) }
  } else {
    stringify-by-func(it)
  }
}

// Convert color parameter (content block) to rgb color value
#let color-param(param, default: "#000000") = {
  let color-str = plain-text(param)
    .trim()
    .replace("\\#", "#")
  if color-str == "" { rgb(default) } else { rgb(color-str) }
}

// Extract spacing parameter from content block
#let spacing-param(param) = {
  let spacing-str = plain-text(param).trim()
  if spacing-str == "" { 0pt } else { eval(spacing-str) }
}

// Extract color parameter with default fallback for missing/empty values
#let color-param-safe(param, default: "#000000") = {
  if param == none or param == [] {
    rgb(default)
  } else {
    color-param(param, default: default)
  }
}

// Extract spacing parameter with default fallback for missing/empty values
#let spacing-param-safe(param, default: 11pt) = {
  if param == none or param == [] {
    default
  } else {
    spacing-param(param)
  }
}

// Extract string parameter with default fallback for missing/empty values
#let string-param-safe(param, default: "Roboto") = {
  if param == none or param == [] {
    default
  } else {
    plain-text(param).trim()
  }
}

// Helper: check if a value is none or empty
#let is-empty(value) = {
  value == none or value == [] or plain-text(value).trim() == ""
}

// Strip protocol and www. from URLs for display purposes
#let strip-protocol(url) = {
  if is-empty(url) {
    ""
  } else {
    let url-str = plain-text(url)
      .replace("https://", "")
      .replace("http://", "")
      .replace("www.", "")
    url-str
  }
}

// Footer with centered author · cvdate | right-aligned page/total
#let footer-content(author, cvdate, light-color, footer-size: 9pt, body-font-str: "Source Sans 3") = context [
  #text(font: body-font-str, size: footer-size, fill: light-color)[
    #box(width: 100%)[
      #align(center)[
        #{
          if not is-empty(author) and not is-empty(cvdate) {
            [#author #h(0.3em) • #h(0.3em) #cvdate]
          } else if not is-empty(author) {
            [#author]
          } else if not is-empty(cvdate) {
            [#cvdate]
          } else {
            []
          }
        }
      ]
      #place(right)[
        #counter(page).display() / #(counter(page).final().first())
      ]
    ]
  ]
]

#let moderncv(
  author: none,
  location: none,
  phone: none,
  email: none,
  website: none,
  socials: (:),
  research-area: none,
  main-color: "#000000",
  accent-color: "#000000",
  light-color: "#999999",
  body-size: 11pt,
  body-line-height: 0.7em,
  heading-1-size: 17pt,
  heading-1-top: -14pt,
  heading-1-bottom: 0pt,
  heading-2-size: 12pt,
  contact-size: 9pt,
  footer-size: 9pt,
  section-spacing: 10pt,
  entry-spacing: 18pt,
  heading-font: "Roboto",
  body-font: "Source Sans 3",
  margins: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
  cvdate: none,
  body,
) = [
  // Extract colors with defaults
  #let main_color = color-param-safe(main-color, default: "#000000")
  #let accent = color-param-safe(accent-color, default: "#000000")
  #let light-color = color-param-safe(light-color, default: "#999999")
  
  // Extract fonts with defaults
  #let heading-font-str = string-param-safe(heading-font, default: "Roboto")
  #let body-font-str = string-param-safe(body-font, default: "Source Sans 3")
  
  // Extract spacing parameters with defaults
  #let body-size = spacing-param-safe(body-size, default: 11pt)
  #let body-line-height = spacing-param-safe(body-line-height, default: 0.7em)
  #let heading-1-size = spacing-param-safe(heading-1-size, default: 17pt)
  #let heading-1-top = spacing-param-safe(heading-1-top, default: -14pt)
  #let heading-1-bottom = spacing-param-safe(heading-1-bottom, default: 0pt)
  #let heading-2-size = spacing-param-safe(heading-2-size, default: 12pt)
  #let contact-size = spacing-param-safe(contact-size, default: 9pt)
  #let footer-size = spacing-param-safe(footer-size, default: 9pt)
  #let section-spacing = spacing-param-safe(section-spacing, default: 10pt)
  #let entry-spacing = spacing-param-safe(entry-spacing, default: 18pt)
  
  // Extract margins with defaults
  #let margins = (
    top: spacing-param-safe(margins.at("top", default: none), default: 2.5cm),
    bottom: spacing-param-safe(margins.at("bottom", default: none), default: 2.5cm),
    left: spacing-param-safe(margins.at("left", default: none), default: 2.5cm),
    right: spacing-param-safe(margins.at("right", default: none), default: 2.5cm),
  )
  
  #let display_name = (
    if author != none { author }
    else { "" }
  )

  #set page(
    margin: margins,
    footer: footer-content(display_name, cvdate, light-color, footer-size: footer-size, body-font-str: body-font-str)
  )
  #set text(font: body-font-str, size: body-size, weight: 400, fill: main_color)
  #set par(leading: body-line-height)
  #set par(justify: true)
  
  #set text(hyphenate: true, costs: (hyphenation: 200%))


  // Show rules to handle strong and emph formatting
  // These override the global weight: 400 set rule
  #show strong: set text(weight: 700)
  #show emph: it => text(font: body-font-str, style: "italic")[#it.body]

  #show heading.where(level: 1): it => block(sticky: true)[
    #text(font: heading-font-str, size: heading-1-size, weight: 600, fill: accent)[#it.body]
    #v(heading-1-top)
    #line(length: 100%, stroke: (paint: accent, thickness: 0.4pt))
    #v(heading-1-bottom)
  ]

  #show heading.where(level: 2): it => block(sticky: true)[
    #context {
      let heading-text = it.body
      let text-content = text(font: heading-font-str, size: heading-2-size, weight: 500, fill: accent)[#heading-text]
      let text-width = measure(text-content).width
       
      layout(page-size => {
        let available = page-size.width - text-width - 0.5em
        let dot = text(font: heading-font-str, size: heading-2-size, weight: 200, fill: accent)[·]
        let dot-width = measure(dot).width
        let dot-count = calc.floor(available.abs.pt() / dot-width.abs.pt())
        let dots = (dot,) * int(dot-count)
        
        [
          #text-content
          #h(0.25em)
          #dots.join()
          #v(0pt)
        ]
      })
    }
    #v(0pt)
  ]
  
  #let fa_glyph(name, size: 0.95em) = box(
    baseline: 85%,
    move(
      dy: -0.7em,  
      fa-icon(name, size: size),
    ),
  )
  
  // Generic icon item: displays icon + spacing + content, with optional link
  #let icon-item(icon, content, url: none) = {
    let icon-box = fa_glyph(icon)
    let spacing = h(0.05em)
    
    if url != none {
      let url-str = plain-text(url)
      [#icon-box #spacing #link(url-str)[#content]]
    } else {
      [#icon-box #spacing #content]
    }
  }

  // Specific constructors using generic function
  #let phone-item(addr) = {
    if is-empty(addr) { none } else { icon-item("phone", addr) }
  }

  #let email-item(addr) = {
    if is-empty(addr) { none } else { icon-item("envelope", addr) }
  }

  #let homepage-item(addr) = {
    if is-empty(addr) { none } else { icon-item("globe", strip-protocol(addr), url: addr) }
  }

  #let social-item(label, icon, url) = {
    if url != none {
      icon-item(icon, label, url: url)
    } else {
      none
    }
  }
  
  #let contact_row_1 = (
    if phone != none { phone-item(phone) } else { none },
    if email != none { email-item(email) } else { none },
    if website != none { homepage-item(website) } else { none },
  )

  #let contact_row_2 = {
    let items = ()
    
    // Add social media items from list
    if socials != none and socials.len() > 0 {
      for info in socials {
        let item = social-item(info.label, info.icon, info.url)
        items.push(item)
      }
    }
    
    // Add CV date if present
    if not is-empty(cvdate) {
      items.push([#fa_glyph("floppy-disk") #h(0.05em) #cvdate])
    }
    
    items
  }

  // Helper: check if a row has any non-none items
  #let has-content(row-items) = {
    row-items.filter(x => x != none).len() > 0
  }

  #block(inset: (bottom: 10pt))[
     #set align(center)
     #grid(columns: (1fr), row-gutter: 0pt)[
        #text(
          font: heading-font-str,
          size: 30pt,
          weight: 700,
          fill: accent,
        )[
          #display_name
         ]
         #if research-area != none and research-area != "" [
           #v(-28pt)
           #text(font: heading-font-str, size: 11pt, weight: 700, fill: accent)[#research-area]
         ]
           #if location != none [
             #v(-5pt)
              #text(font: heading-font-str, size: contact-size, weight: 400, fill: light-color)[#location]
            ]
           #if has-content(contact_row_1) [
             #v(-4pt)
             #text(font: heading-font-str, size: contact-size, weight: 400, fill: light-color)[
             #set par(leading: 0pt)
             #(
               contact_row_1
                 .filter(x => x != none)
                 .intersperse([ #h(0.6em) ● #h(0.6em) ])
                 .join()
             )
            ]
           ]
           #if has-content(contact_row_2) [
             #v(-10pt)
             #text(font: heading-font-str, size: contact-size, weight: 400, fill: light-color)[
             #set par(leading: 0pt)
             #(
               contact_row_2
                 .filter(x => x != none)
                 .intersperse([ #h(0.6em) ● #h(0.6em) ])
                 .join()
             )
           ]
           ]
     ]
    ]

   // Bibliography formatting
   #show: content => {
     set list(marker: [▷], indent: 0.3em, body-indent: 0.5em)
     content
   }

  #(body)
  ]

// Build socials from metadata - supports any platform via list iteration
#let socials_data = (
$for(socials)$  (url: [$it.url$], icon: "$it.icon$", label: "$it.label$"),
$endfor$
)

#show: body => {
  moderncv(
    author: [$author$],

    location: [$main_info_location$],
    phone:    [$main_info_phone$],
    email:    [$main_info_email$],
    website:  [$main_info_website$],
    socials:  socials_data,
    
    research-area: [$main_info_research_area$],

    main-color: [$colors_main$],
    accent-color: [$colors_accent$],
    light-color: [$colors_light$],
    
    body-size: [$text_settings_body_size$],
    body-line-height: [$text_settings_body_line_height$],
    heading-1-size: [$text_settings_heading_1_size$],
    heading-1-top: [$text_settings_heading_1_top$],
    heading-1-bottom: [$text_settings_heading_1_bottom$],
    heading-2-size: [$text_settings_heading_2_size$],
    contact-size: [$text_settings_contact_size$],
    footer-size: [$text_settings_footer_size$],
    section-spacing: [$text_settings_section_spacing$],
    entry-spacing: [$text_settings_entry_spacing$],
    
    heading-font: [$typography_heading_font$],
    body-font: [$typography_body_font$],
    
    margins: (
      top: [$margins_top$],
      bottom: [$margins_bottom$],
      left: [$margins_left$],
      right: [$margins_right$],
    ),
    cvdate: [$cvdate$],

    body
  )
}