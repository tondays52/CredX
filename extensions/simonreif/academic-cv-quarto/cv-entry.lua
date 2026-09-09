-- cv-entry.lua - Unified CV entry shortcode for positions and activities
-- Loads entry data from YAML files in a single consistent format:
--   List of objects with date and content fields
-- Renders as Typst table with configurable left column width and alignment
-- Usage: {{< cv-entry file="file.yaml" columnWidth="80pt" align="right, left" >}}
-- Note: align parameter is optional, defaults to "right, left"

local utils = require("pandoc.utils")
local stringify = utils.stringify

-- Helper function to get shortcode parameters
local function get_params(kwargs)
  local file = nil
  local columnWidth = nil
  local align = "right, left"  -- Default alignment
  
  if kwargs then
    if kwargs.file then
      file = stringify(kwargs.file)
    end
    if kwargs.columnWidth then
      columnWidth = stringify(kwargs.columnWidth)
    end
    if kwargs.align then
      align = stringify(kwargs.align)
    end
  end
  
  if not file then
    quarto.log.warning("cv-entry: No file parameter specified")
    return nil, nil, nil
  end
  
  if not columnWidth then
    quarto.log.warning("cv-entry: No columnWidth parameter specified")
    return nil, nil, nil
  end
  
  return file, columnWidth, align
end

-- Helper function to resolve file path relative to document
local function resolve_file_path(filename)
  if not filename then
    return nil
  end
  
  -- If already absolute path, return as-is
  if filename:sub(1, 1) == "/" then
    return filename
  end
  
  -- If relative path, use as-is (Quarto renders from document directory)
  return filename
end

-- Helper function to read file content
local function read_file(filepath)
  local file, err = io.open(filepath, "r")
  if not file then
    quarto.log.warning("cv-entry: Could not open file '" .. filepath .. "': " .. (err or "unknown error"))
    return nil
  end
  
  local content = file:read("*a")
  file:close()
  return content
end

-- Helper function to strip surrounding quotes from values
local function strip_quotes(str)
  if not str then return str end
  
  -- First remove leading/trailing whitespace
  str = str:match("^%s*(.-)%s*$")
  
  -- Remove surrounding double quotes
  if str:sub(1, 1) == '"' and str:sub(-1) == '"' then
    return str:sub(2, -2)
  end
  
  -- Remove surrounding single quotes
  if str:sub(1, 1) == "'" and str:sub(-1) == "'" then
    return str:sub(2, -2)
  end
  
  return str
end

-- Convert Markdown formatting to Typst code
-- Handles: **bold** → #strong[...]
--          *italic* → #emph[...]
--          ***both*** → #strong[#emph[...]]
local function convert_markdown_to_typst(text)
  if not text then return text end
  
  -- Handle ***bold-italic*** first (to avoid partial matches)
  text = text:gsub("%*%*%*(.-)%*%*%*", "#strong[#emph[%1]]")
  
  -- Handle **bold**
  text = text:gsub("%*%*(.-)%*%*", "#strong[%1]")
  
  -- Handle *italic*
  text = text:gsub("%*(.-)%*", "#emph[%1]")
  
  return text
end

-- Parse YAML: List of objects with date and content fields
local function parse_yaml_entries(content)
  local entries = {}
  local current_entry = nil
  
  for line in content:gmatch("[^\n]+") do
    -- Skip empty lines and comments
    if line:match("^%s*$") or line:match("^%s*#") then
      goto continue
    end
    
    -- Check for new entry marker (dash at start)
    if line:match("^%s*%-") then
      if current_entry and (current_entry.date or current_entry.content) then
        table.insert(entries, current_entry)
      end
      current_entry = {}
      
      -- Try to get first field on same line
      local rest = line:gsub("^%s*%-", ""):match("^%s*(.*)")
      if rest and rest ~= "" then
        local key, value = rest:match("^([^:]+):%s*(.*)")
        if key and value then
          current_entry[key:match("^%s*(.-)%s*$")] = strip_quotes(value)
        end
      end
    elseif current_entry then
      -- Parse key: value pair
      local key, value = line:match("^%s*([^:]+):%s*(.*)")
      if key and value then
        key = key:match("^%s*(.-)%s*$")
        value = strip_quotes(value)
        current_entry[key] = value
      end
    end
    
    ::continue::
  end
  
  -- Don't forget the last entry
  if current_entry and (current_entry.date or current_entry.content) then
    table.insert(entries, current_entry)
  end
  
  return #entries > 0 and entries or nil
end

-- Load and parse YAML file
local function load_entries(filepath)
  if not filepath then
    quarto.log.warning("cv-entry: No file parameter specified")
    return nil
  end
  
  local resolved_path = resolve_file_path(filepath)
  local content = read_file(resolved_path)
  
  if not content then
    return nil
  end
  
  -- Parse YAML as list of objects
  local entries = parse_yaml_entries(content)
  
  return entries
end

-- Generate Typst table with configurable column width and alignment
local function generate_typst_table(entries, columnWidth, align)
  if not entries or #entries == 0 then
    quarto.log.warning("cv-entry: No entries found in YAML file")
    return pandoc.Para("No entries data found")
  end
  
  -- Build Typst table code
  local typst_code = "#table(\n"
  typst_code = typst_code .. "  columns: (" .. columnWidth .. ", 1fr),\n"
  typst_code = typst_code .. "  align: (" .. align .. "),\n"
  typst_code = typst_code .. "  gutter: 12pt,\n"
  typst_code = typst_code .. "  inset: 0pt,\n"
  
  for i, entry in ipairs(entries) do
    -- Date/Year column: apply Markdown formatting
    local date_text = entry.date or ""
    date_text = convert_markdown_to_typst(date_text)
    typst_code = typst_code .. "  [" .. date_text .. "],\n"
    
    -- Content column: apply Markdown formatting
    local content = entry.content or ""
    content = convert_markdown_to_typst(content)
    
    typst_code = typst_code .. "  [" .. content .. "],\n"
  end
  
  typst_code = typst_code .. ")\n"
  
  -- Return as raw Typst block
  return pandoc.RawBlock("typst", typst_code)
end

-- Main shortcode handler
return {
  ['cv-entry'] = function(args, kwargs, meta)
    local file, columnWidth, align = get_params(kwargs)
    
    if not file or not columnWidth or not align then
      return pandoc.Para("")
    end
    
    local entries = load_entries(file)
    
    if entries then
      return generate_typst_table(entries, columnWidth, align)
    else
      return pandoc.Para("")
    end
  end
}
