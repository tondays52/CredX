-- parse-bibtex.lua - Parse BibTeX files and generate formatted bibliography
--
-- This filter reads BibTeX files and generates a formatted bibliography with:
-- - Triangle bullet points (▶)
-- - Bold titles with DOI/URL links
-- - Italic journal names
-- - Year in parentheses
-- - Sorted newest first (descending by year)
-- - Up to 20 authors (then "et al.")
-- - No month or DOI text display
-- - Proper indentation (hanging indent)

local pandoc = require 'pandoc'
local utils = pandoc.utils

-- Configuration
local DOC_META = {}

-- Helper: trim whitespace
local function trim(str)
  return str:match("^%s*(.-)%s*$")
end

-- Helper: split string by separator (handles multi-character separators)
local function split(str, sep)
  local result = {}
  local start = 1
  
  while true do
    local pos = str:find(sep, start, true)  -- true for plain text search
    if not pos then
      if start <= #str then
        table.insert(result, trim(str:sub(start)))
      end
      break
    end
    table.insert(result, trim(str:sub(start, pos - 1)))
    start = pos + #sep
  end
  
  return result
end

-- Helper: remove braces and special formatting from BibTeX strings
local function clean_text(str)
  if not str then return "" end
  -- Remove outer braces
  str = str:gsub("^%{(.+)%}$", "%1")
  
  -- Remove spaces after LaTeX special character commands (Better BibTeX output)
  -- These commands represent complete characters and shouldn't have trailing spaces
  -- Matches: \o, \aa, \ss, \"a, etc. followed by whitespace
  str = str:gsub("\\([a-zA-Z]+)%s+", "\\%1")
  
  -- Clean up LaTeX special characters and commands
  -- Handle special LaTeX commands with braces: {\ss} -> ß
  str = str:gsub("%{\\\\ss%}", "ß")
  str = str:gsub("\\\\ss", "ß")
  str = str:gsub("%{\\ss%}", "ß")
  str = str:gsub("\\ss", "ß")
  
  -- Handle other common LaTeX special characters
  str = str:gsub("%{\\\\ae%}", "æ")
  str = str:gsub("\\\\ae", "æ")
  str = str:gsub("%{\\ae%}", "æ")
  str = str:gsub("\\ae", "æ")
  
  str = str:gsub("%{\\\\o%}", "ø")
  str = str:gsub("\\\\o", "ø")
  str = str:gsub("%{\\o%}", "ø")
  str = str:gsub("\\o", "ø")
  
  str = str:gsub("%{\\\\aa%}", "å")
  str = str:gsub("\\\\aa", "å")
  str = str:gsub("%{\\aa%}", "å")
  str = str:gsub("\\aa", "å")
  
  str = str:gsub("%{\\\\l%}", "ł")
  str = str:gsub("\\\\l", "ł")
  str = str:gsub("%{\\l%}", "ł")
  str = str:gsub("\\l", "ł")
  
  str = str:gsub("%{\\\\O%}", "Ø")
  str = str:gsub("\\\\O", "Ø")
  str = str:gsub("%{\\O%}", "Ø")
  str = str:gsub("\\O", "Ø")
  
   str = str:gsub("%{\\\\L%}", "Ł")
   str = str:gsub("\\\\L", "Ł")
   str = str:gsub("%{\\L%}", "Ł")
   str = str:gsub("\\L", "Ł")
   
   -- GERMAN UMLAUTS (Diaeresis) - handle all variants
   -- Double-escaped braced forms
   str = str:gsub("%{\\\\\"a%}", "ä")
   str = str:gsub("%{\\\\\"o%}", "ö")
   str = str:gsub("%{\\\\\"u%}", "ü")
   str = str:gsub("%{\\\\\"A%}", "Ä")
   str = str:gsub("%{\\\\\"O%}", "Ö")
   str = str:gsub("%{\\\\\"U%}", "Ü")
   str = str:gsub("%{\\\\\"e%}", "ë")
   str = str:gsub("%{\\\\\"i%}", "ï")
   str = str:gsub("%{\\\\\"E%}", "Ë")
   str = str:gsub("%{\\\\\"I%}", "Ï")
   
   -- Double-escaped unbraced
   str = str:gsub("\\\\\"a", "ä")
   str = str:gsub("\\\\\"o", "ö")
   str = str:gsub("\\\\\"u", "ü")
   str = str:gsub("\\\\\"A", "Ä")
   str = str:gsub("\\\\\"O", "Ö")
   str = str:gsub("\\\\\"U", "Ü")
   str = str:gsub("\\\\\"e", "ë")
   str = str:gsub("\\\\\"i", "ï")
   str = str:gsub("\\\\\"E", "Ë")
   str = str:gsub("\\\\\"I", "Ï")
   
   -- Single-escaped braced
   str = str:gsub("%{\\\"a%}", "ä")
   str = str:gsub("%{\\\"o%}", "ö")
   str = str:gsub("%{\\\"u%}", "ü")
   str = str:gsub("%{\\\"A%}", "Ä")
   str = str:gsub("%{\\\"O%}", "Ö")
   str = str:gsub("%{\\\"U%}", "Ü")
   str = str:gsub("%{\\\"e%}", "ë")
   str = str:gsub("%{\\\"i%}", "ï")
   str = str:gsub("%{\\\"E%}", "Ë")
   str = str:gsub("%{\\\"I%}", "Ï")
   
   -- Single-escaped unbraced
   str = str:gsub("\\\"a", "ä")
   str = str:gsub("\\\"o", "ö")
   str = str:gsub("\\\"u", "ü")
   str = str:gsub("\\\"A", "Ä")
   str = str:gsub("\\\"O", "Ö")
   str = str:gsub("\\\"U", "Ü")
   str = str:gsub("\\\"e", "ë")
   str = str:gsub("\\\"i", "ï")
   str = str:gsub("\\\"E", "Ë")
   str = str:gsub("\\\"I", "Ï")
   
   -- ACUTE ACCENTS (French/Spanish) - \'a → á
   -- Double-escaped braced
   str = str:gsub("%{\\\\'a%}", "á")
   str = str:gsub("%{\\\\'e%}", "é")
   str = str:gsub("%{\\\\'i%}", "í")
   str = str:gsub("%{\\\\'o%}", "ó")
   str = str:gsub("%{\\\\'u%}", "ú")
   str = str:gsub("%{\\\\'A%}", "Á")
   str = str:gsub("%{\\\\'E%}", "É")
   str = str:gsub("%{\\\\'I%}", "Í")
   str = str:gsub("%{\\\\'O%}", "Ó")
   str = str:gsub("%{\\\\'U%}", "Ú")
   
   -- Double-escaped unbraced
   str = str:gsub("\\\\\'a", "á")
   str = str:gsub("\\\\\'e", "é")
   str = str:gsub("\\\\\'i", "í")
   str = str:gsub("\\\\\'o", "ó")
   str = str:gsub("\\\\\'u", "ú")
   str = str:gsub("\\\\\'A", "Á")
   str = str:gsub("\\\\\'E", "É")
   str = str:gsub("\\\\\'I", "Í")
   str = str:gsub("\\\\\'O", "Ó")
   str = str:gsub("\\\\\'U", "Ú")
   
   -- Single-escaped braced
   str = str:gsub("%{\\'a%}", "á")
   str = str:gsub("%{\\'e%}", "é")
   str = str:gsub("%{\\'i%}", "í")
   str = str:gsub("%{\\'o%}", "ó")
   str = str:gsub("%{\\'u%}", "ú")
   str = str:gsub("%{\\'A%}", "Á")
   str = str:gsub("%{\\'E%}", "É")
   str = str:gsub("%{\\'I%}", "Í")
   str = str:gsub("%{\\'O%}", "Ó")
   str = str:gsub("%{\\'U%}", "Ú")
   
   -- Single-escaped unbraced
   str = str:gsub("\\'a", "á")
   str = str:gsub("\\'e", "é")
   str = str:gsub("\\'i", "í")
   str = str:gsub("\\'o", "ó")
   str = str:gsub("\\'u", "ú")
   str = str:gsub("\\'A", "Á")
   str = str:gsub("\\'E", "É")
   str = str:gsub("\\'I", "Í")
   str = str:gsub("\\'O", "Ó")
   str = str:gsub("\\'U", "Ú")
   
   -- GRAVE ACCENTS (French) - \`a → à
   -- Single-escaped braced
   str = str:gsub("%{\\`a%}", "à")
   str = str:gsub("%{\\`e%}", "è")
   str = str:gsub("%{\\`i%}", "ì")
   str = str:gsub("%{\\`o%}", "ò")
   str = str:gsub("%{\\`u%}", "ù")
   str = str:gsub("%{\\`A%}", "À")
   str = str:gsub("%{\\`E%}", "È")
   str = str:gsub("%{\\`I%}", "Ì")
   str = str:gsub("%{\\`O%}", "Ò")
   str = str:gsub("%{\\`U%}", "Ù")
   
   -- Single-escaped unbraced
   str = str:gsub("\\`a", "à")
   str = str:gsub("\\`e", "è")
   str = str:gsub("\\`i", "ì")
   str = str:gsub("\\`o", "ò")
   str = str:gsub("\\`u", "ù")
   str = str:gsub("\\`A", "À")
   str = str:gsub("\\`E", "È")
   str = str:gsub("\\`I", "Ì")
   str = str:gsub("\\`O", "Ò")
   str = str:gsub("\\`U", "Ù")
   
   -- CIRCUMFLEX ACCENTS - \^a → â
   -- Single-escaped braced
   str = str:gsub("%{\\^a%}", "â")
   str = str:gsub("%{\\^e%}", "ê")
   str = str:gsub("%{\\^i%}", "î")
   str = str:gsub("%{\\^o%}", "ô")
   str = str:gsub("%{\\^u%}", "û")
   str = str:gsub("%{\\^A%}", "Â")
   str = str:gsub("%{\\^E%}", "Ê")
   str = str:gsub("%{\\^I%}", "Î")
   str = str:gsub("%{\\^O%}", "Ô")
   str = str:gsub("%{\\^U%}", "Û")
   
   -- Single-escaped unbraced
   str = str:gsub("\\^a", "â")
   str = str:gsub("\\^e", "ê")
   str = str:gsub("\\^i", "î")
   str = str:gsub("\\^o", "ô")
   str = str:gsub("\\^u", "û")
   str = str:gsub("\\^A", "Â")
   str = str:gsub("\\^E", "Ê")
   str = str:gsub("\\^I", "Î")
   str = str:gsub("\\^O", "Ô")
   str = str:gsub("\\^U", "Û")
   
   -- TILDE ACCENTS - \~a → ã
   str = str:gsub("%{\\~a%}", "ã")
   str = str:gsub("%{\\~n%}", "ñ")
   str = str:gsub("%{\\~o%}", "õ")
   str = str:gsub("%{\\~A%}", "Ã")
   str = str:gsub("%{\\~N%}", "Ñ")
   str = str:gsub("%{\\~O%}", "Õ")
   
   str = str:gsub("\\~a", "ã")
   str = str:gsub("\\~n", "ñ")
   str = str:gsub("\\~o", "õ")
   str = str:gsub("\\~A", "Ã")
   str = str:gsub("\\~N", "Ñ")
   str = str:gsub("\\~O", "Õ")
   
   -- CEDILLA - \c{c} → ç
   str = str:gsub("%{\\c{c}%}", "ç")
   str = str:gsub("%{\\c{C}%}", "Ç")
   str = str:gsub("\\c{c}", "ç")
   str = str:gsub("\\c{C}", "Ç")
   
   -- CARON (háček) - \v{s} → š
   str = str:gsub("%{\\v{s}%}", "š")
   str = str:gsub("%{\\v{z}%}", "ž")
   str = str:gsub("%{\\v{S}%}", "Š")
   str = str:gsub("%{\\v{Z}%}", "Ž")
   str = str:gsub("%{\\v{c}%}", "č")
   str = str:gsub("%{\\v{C}%}", "Č")
   
   str = str:gsub("\\v{s}", "š")
   str = str:gsub("\\v{z}", "ž")
   str = str:gsub("\\v{S}", "Š")
   str = str:gsub("\\v{Z}", "Ž")
   str = str:gsub("\\v{c}", "č")
   str = str:gsub("\\v{C}", "Č")
   
   -- SCANDINAVIAN UPPERCASE (add missing variants)
   str = str:gsub("%{\\\\AA%}", "Å")
   str = str:gsub("\\\\AA", "Å")
   str = str:gsub("%{\\AA%}", "Å")
   str = str:gsub("\\AA", "Å")
   
   str = str:gsub("%{\\\\AE%}", "Æ")
   str = str:gsub("\\\\AE", "Æ")
   str = str:gsub("%{\\AE%}", "Æ")
   str = str:gsub("\\AE", "Æ")
   
   -- Handle other common LaTeX escapes
  str = str:gsub("\\\\&", "&")  -- \\& -> &
  str = str:gsub("\\&", "&")    -- \& -> &
  str = str:gsub("\\%-", "-")   -- \\- -> -
  
   -- Remove empty braces (e.g., \ss{} -> ß with no trailing {})
   str = str:gsub("%{%}", "")
   
   -- Remove braces for case protection (multiple passes for nested braces)
   str = str:gsub("%{%{", "{")  -- {{ -> {
   str = str:gsub("%}%}", "}")  -- }} -> }
   -- Peel away brace layers iteratively to handle nested braces like {{text}}
   for _ = 1, 4 do
     str = str:gsub("%{([^{}]+)%}", "%1")  -- {word} -> word
   end
  
  -- Replace -- with en dash
  str = str:gsub("%-%-", "–")
  
  return trim(str)
end

-- Helper function to extract field value handling multiline and nested braces
local function extract_field_by_name(text, field_name)
  -- Pattern: fieldname = {value} or "value"
  local pattern = field_name .. '%s*=%s*[{"](.-)[]"}]'
  
  -- For braced values, we need to handle nesting
  local start_idx = text:lower():find(field_name:lower() .. '%s*=')
  if not start_idx then return nil end
  
  local eq_idx = text:find('=', start_idx)
  if not eq_idx then return nil end
  
  -- Skip whitespace after =
  local val_start = eq_idx + 1
  while val_start <= #text and text:sub(val_start, val_start):match('%s') do
    val_start = val_start + 1
  end
  
  if val_start > #text then return nil end
  
  local first_char = text:sub(val_start, val_start)
  if first_char == '{' then
    -- Find matching closing brace
    local brace_level = 0
    for i = val_start, #text do
      local c = text:sub(i, i)
      if c == '{' then
        brace_level = brace_level + 1
      elseif c == '}' then
        brace_level = brace_level - 1
        if brace_level == 0 then
          return trim(text:sub(val_start + 1, i - 1))
        end
      end
    end
  elseif first_char == '"' then
    -- Find closing quote
    local close_idx = text:find('"', val_start + 1)
    if close_idx then
      return trim(text:sub(val_start + 1, close_idx - 1))
    end
  end
  
  return nil
end

-- Helper function to extract multiple fields with optional post-processing
local function extract_multiple_fields(entry, entry_text, fields_config)
  -- fields_config: array of either strings (field name) or tables {name, post_process_func}
  for _, field_config in ipairs(fields_config) do
    local field_name, post_process = field_name, nil
    
    if type(field_config) == "string" then
      field_name = field_config
    else
      field_name = field_config[1]
      post_process = field_config[2]
    end
    
    local field_val = extract_field_by_name(entry_text, field_name)
    if field_val then
      if post_process then
        field_val = post_process(field_val)
      end
      entry[field_name:lower()] = clean_text(field_val)
    end
  end
end

-- Parse a single BibTeX entry
local function parse_bibtex_entry(entry_text)
  local entry = {}
  
  -- Extract entry type and key
  local entry_type, key = entry_text:match("@(%w+)%s*%{%s*([^,]+)")
  if not entry_type or not key then
    return nil
  end
  
  entry.type = entry_type:lower()
  entry.key = trim(key)
  
  -- Handle year (special case - uses pattern matching, not extract_field_by_name)
  local year_match = entry_text:match('year%s*=%s*(%d+)')
  if year_match then
    entry.year = year_match
  end
  
  -- Define fields with optional post-processing
  -- Fields with no post-processing are simple strings
  -- Fields needing newline normalization include a post-processing function
  local fields = {
    "title",
    { "author", function(v) return v:gsub("\n", " ") end },
    "journal",
    "booktitle",
    "publisher",
    "school",
    "volume",
    "number",
    "pages",
    { "editor", function(v) return v:gsub("\n", " ") end },
    "doi",
    "url"
  }
  
  extract_multiple_fields(entry, entry_text, fields)
  
  return entry
end

-- Read and parse a BibTeX file
local function read_bibtex_file(filepath)
  local file = io.open(filepath, "r")
  if not file then
    return {}
  end
  
  local content = file:read("*a")
  file:close()
  
  local entries = {}
  -- Split by @ to find entries - match from @ to next @ or end of file
  for entry_text in content:gmatch("@[^@]*") do
    local entry = parse_bibtex_entry(entry_text)
    if entry then
      table.insert(entries, entry)
    end
  end
  
  return entries
end

-- Parse "Lastname, Firstname" format into separate components
-- Input: "Lastname, Firstname" or similar BibTeX author format
-- Output: table with {lastname = "...", firstname = "..."} or nil if parsing fails
local function parse_author_name(author_str)
  author_str = trim(author_str)
  
  -- Check if author string contains a comma (BibTeX "Lastname, Firstname" format)
  if not author_str:find(",") then
    -- No comma found, parsing failed - return nil to use original format
    return nil
  end
  
  -- Split by comma
  local parts = split(author_str, ",")
  if #parts < 2 then
    -- Not enough parts, return nil
    return nil
  end
  
  local lastname = trim(parts[1])
  local firstname = trim(parts[2])
  
  -- Return parsed components
  return {
    lastname = lastname,
    firstname = firstname
  }
end

-- Format a single author based on their position in the author list
-- If first_author is true: keep "Lastname, Firstname" (BibTeX format)
-- If first_author is false: convert to "Firstname Lastname" (normal order)
local function format_single_author(author_str, is_first_author)
  if is_first_author then
    -- First author: keep BibTeX format "Lastname, Firstname"
    return author_str
  else
    -- Other authors: convert to "Firstname Lastname"
    local parsed = parse_author_name(author_str)
    if parsed then
      -- Successfully parsed, return in normal order
      return parsed.firstname .. " " .. parsed.lastname
    else
      -- Parsing failed, fall back to original BibTeX author string
      return author_str
    end
  end
end

-- Parse author string and return formatted author list
local function format_authors(author_str, max_authors)
  max_authors = max_authors or 20
  if not author_str then return "" end
  
  -- Split by " and "
  local authors = split(author_str, " and ")
  
  -- Format each author based on position (first vs others)
  local formatted_authors = {}
  for i, author in ipairs(authors) do
    local is_first = (i == 1)
    table.insert(formatted_authors, format_single_author(author, is_first))
  end
  
  if #formatted_authors > max_authors then
    -- Truncate and add "et al."
    local result = {}
    for i = 1, max_authors do
      table.insert(result, formatted_authors[i])
    end
    return table.concat(result, ", ") .. ", et al."
  else
    -- Format with proper separators: commas between all, " & " before last (no comma before &)
    if #formatted_authors == 1 then
      return formatted_authors[1]
    elseif #formatted_authors == 2 then
      return formatted_authors[1] .. " & " .. formatted_authors[2]
    else
      local all_but_last = table.concat(formatted_authors, ", ", 1, #formatted_authors - 1)
      return all_but_last .. " & " .. formatted_authors[#formatted_authors]
    end
  end
end

-- Format a single entry as Pandoc inlines
-- Helper: determine page prefix (p. for single page, pp. for multiple)
local function get_page_prefix(pages)
  if not pages then return "" end
  -- Check if pages contains a dash, en-dash, or em-dash (indicating a range)
  if pages:match("%-%-") or pages:match("–") or pages:match("—") or pages:match("%d%s*%-+%s*%d") then
    return "pp. "
  else
    return "p. "
  end
end

local function format_entry_inlines(entry)
  local inlines = {}
  
  -- Author or Editor (Year)
  -- Use author if present, fallback to editor, otherwise just year
  local name_str = entry.author or entry.editor
  if name_str then
    local names = format_authors(name_str, 20)
    table.insert(inlines, pandoc.Str(names))
    
    if entry.year then
      table.insert(inlines, pandoc.Str(" (" .. entry.year .. ")"))
    end
    table.insert(inlines, pandoc.Str(" "))
  elseif entry.year then
    -- Year without author/editor (rare)
    table.insert(inlines, pandoc.Str("(" .. entry.year .. ") "))
  end
  
  -- "Title" (with link if DOI/URL exists)
  if entry.title then
    local title = entry.title
    local link_url = nil
    
    -- Prefer DOI, fallback to URL
    if entry.doi then
      link_url = entry.doi
      -- Add https://doi.org/ prefix if needed
      if not link_url:match("^https?://") then
        link_url = "https://doi.org/" .. link_url
      end
    elseif entry.url then
      link_url = entry.url
    end
    
    -- Create link if URL exists
    if link_url then
      -- Bold linked title with quotes
      local title_link = pandoc.Link({pandoc.Strong({pandoc.Str('"' .. title .. '"')})}, link_url)
      table.insert(inlines, title_link)
    else
      -- Just bold title with quotes, not clickable
      table.insert(inlines, pandoc.Strong({pandoc.Str('"' .. title .. '"')}))
    end
  end
  
  -- Determine thesis type label for phdthesis/mastersthesis
  local thesis_type_label = ""
  if entry.type == "phdthesis" then
    thesis_type_label = "PhD Thesis"
  elseif entry.type == "mastersthesis" then
    thesis_type_label = "Master Thesis"
  end
  
  -- Add thesis type if applicable (in italic)
  local needs_separator = false
  if thesis_type_label ~= "" then
    -- Add comma after title, then italic thesis type
    table.insert(inlines, pandoc.Str(", "))
    table.insert(inlines, pandoc.Emph({pandoc.Str(thesis_type_label)}))
    needs_separator = true  -- Set to true because thesis type was added
  elseif entry.title and (entry.journal or entry.booktitle or entry.school or entry.publisher or entry.volume or entry.number or entry.pages) then
    -- Track if we need a separator before the next element
    -- Set to true if title was added AND there's content following
    needs_separator = true
  end
  
  -- Venue: journal, booktitle, or school
  -- Priority: journal (articles) > booktitle (inproceedings/incollection) > school (theses) > publisher (books)
  -- Special handling: for theses, school is NOT italic (unlike other venues)
  local venue = entry.journal or entry.booktitle or entry.school or entry.publisher
  if venue then
    if needs_separator then
      table.insert(inlines, pandoc.Str(", "))
    end
    -- Only italicize for non-thesis entries; school for theses should be normal text
    if entry.type == "phdthesis" or entry.type == "mastersthesis" then
      -- For theses: school in normal text
      table.insert(inlines, pandoc.Str(venue))
    else
      -- For other entries: venue in italic
      table.insert(inlines, pandoc.Emph({pandoc.Str(venue)}))
    end
    needs_separator = true
  end
  
  -- Editors and publisher for incollection/chapter entries
  if entry.type == "incollection" or entry.type == "chapter" then
    -- Display editors after booktitle
    if entry.editor and entry.booktitle then
      local editors = format_authors(entry.editor, 20)
      table.insert(inlines, pandoc.Str(" (Ed. " .. editors .. ")"))
    end
    
    -- Display publisher in normal text (not italic)
    if entry.publisher then
      if entry.editor or entry.booktitle then
        table.insert(inlines, pandoc.Str(", "))
      end
      table.insert(inlines, pandoc.Str(entry.publisher))
      needs_separator = true
    end
  end
  
  -- Vol. X, No. Y: pp./p. Z
  -- Build volume/issue/pages string
  local vol_issue_pages = ""
  
  if entry.volume then
    vol_issue_pages = vol_issue_pages .. "Vol. " .. entry.volume
  end
  
  if entry.number then
    if vol_issue_pages ~= "" then
      vol_issue_pages = vol_issue_pages .. ", "
    end
    vol_issue_pages = vol_issue_pages .. "No. " .. entry.number
  end
  
  if entry.pages then
    if vol_issue_pages ~= "" then
      vol_issue_pages = vol_issue_pages .. ": " .. get_page_prefix(entry.pages) .. entry.pages
    else
      vol_issue_pages = vol_issue_pages .. get_page_prefix(entry.pages) .. entry.pages
    end
  end
  
  if vol_issue_pages ~= "" then
    if needs_separator then
      table.insert(inlines, pandoc.Str(", "))
    end
    table.insert(inlines, pandoc.Str(vol_issue_pages))
    needs_separator = true
  end
  
  -- Final period
  table.insert(inlines, pandoc.Str("."))
  
  return inlines
end

-- Sort entries by year (descending, newest first), then by author
local function sort_entries(entries)
  table.sort(entries, function(a, b)
    local year_a = tonumber(a.year) or 0
    local year_b = tonumber(b.year) or 0
    if year_a ~= year_b then
      return year_a > year_b  -- Descending (newest first)
    end
    -- If years equal, sort by author
    return (a.author or "") < (b.author or "")
  end)
  return entries
end

-- Helper: safely extract metadata value
local function get_meta_value(meta, key)
  if not meta or not meta[key] then
    return nil
  end
  
  local val = meta[key]
  
  -- Handle MetaInlines
  if type(val) == 'table' and val.t then
    if val.t == 'MetaInlines' then
      return utils.stringify(val)
    elseif val.t == 'MetaMap' then
      return val
    end
  end
  
  -- If it's already a simple table/map, return it
  if type(val) == 'table' and not val.t then
    return val
  end
  
  return utils.stringify(val)
end

-- Process bibliography divs
local function process_bibliography(div)
  if not div.identifier or not div.identifier:match("^refs%-") then
    return div
  end
  
  -- Extract bibliography name from div ID
  local bib_name = div.identifier:match("^refs%-?(.*)$")
  
  -- Get the bibliography file path from metadata
  local bib_files = get_meta_value(DOC_META, "bib-files")
  
  if not bib_files then
    return div
  end
  
  local bib_file = nil
  if type(bib_files) == 'table' then
    -- Try to get the value from the map
    if bib_files[bib_name] then
      bib_file = utils.stringify(bib_files[bib_name])
    end
  end
  
  if not bib_file then
    return div
  end
  
  -- Read and parse the BibTeX file
  local entries = read_bibtex_file(bib_file)
  if #entries == 0 then
    return div
  end
  
  -- Sort entries
  entries = sort_entries(entries)
  
  -- Create formatted list items for proper hanging indent
  local list_items = {}
  for _, entry in ipairs(entries) do
    local inlines = format_entry_inlines(entry)
    -- Create list item with paragraph containing the formatted entry
    table.insert(list_items, {pandoc.Para(inlines)})
  end
  
   -- Replace div content with a bullet list wrapped in a block with spacing
   -- This creates proper hanging indent in LaTeX/Typst with consistent 18pt spacing
   local bullet_list = pandoc.BulletList(list_items)
   
   -- Create new content with spacing wrapper for Typst
   local new_content = {
     pandoc.RawBlock("typst", "#block(spacing: 18pt)["),
     bullet_list,
     pandoc.RawBlock("typst", "]")
   }
   
   div.content = new_content
   return div
end

-- Main filter
return {
  {
    Meta = function(m)
      DOC_META = m
      return m
    end
  },
  {
    Div = process_bibliography
  }
}
