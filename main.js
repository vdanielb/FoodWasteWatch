// Global data cache to avoid redundant loading
let globalWasteData = null;
let globalTopoData = null;

// Shared constants to avoid duplication
const STATE_POPULATION_2023 = {
  "Alabama": 5074296, "Alaska": 733406, "Arizona": 7359191, "Arkansas": 3045637, "California": 38918045,
  "Colorado": 5912064, "Connecticut": 3605944, "Delaware": 1045631, "District of Columbia": 678972, "Florida": 22377446,
  "Georgia": 11015963, "Hawaii": 1427539, "Idaho": 1942571, "Illinois": 12582032, "Indiana": 6842384,
  "Iowa": 3205690, "Kansas": 2934582, "Kentucky": 4546607, "Louisiana": 4569031, "Maine": 1396966,
  "Maryland": 6195295, "Massachusetts": 6981974, "Michigan": 10061863, "Minnesota": 5737914, "Mississippi": 2918320,
  "Missouri": 6168187, "Montana": 1103349, "Nebraska": 1961504, "Nevada": 3235251, "New Hampshire": 1388992,
  "New Jersey": 9261692, "New Mexico": 2115252, "New York": 19453561, "North Carolina": 10701022, "North Dakota": 779261,
  "Ohio": 11780017, "Oklahoma": 4019800, "Oregon": 4237256, "Pennsylvania": 12801989, "Rhode Island": 1097379,
  "South Carolina": 5321610, "South Dakota": 909824, "Tennessee": 7092654, "Texas": 30439188, "Utah": 3402027,
  "Vermont": 647156, "Virginia": 8683619, "Washington": 7715946, "West Virginia": 1778070, "Wisconsin": 5893718,
  "Wyoming": 586485
};

const STATE_ID_TO_NAME = new Map([
  ["01", "Alabama"], ["02", "Alaska"], ["04", "Arizona"], ["05", "Arkansas"], ["06", "California"],
  ["08", "Colorado"], ["09", "Connecticut"], ["10", "Delaware"], ["11", "District of Columbia"], ["12", "Florida"],
  ["13", "Georgia"], ["15", "Hawaii"], ["16", "Idaho"], ["17", "Illinois"], ["18", "Indiana"],
  ["19", "Iowa"], ["20", "Kansas"], ["21", "Kentucky"], ["22", "Louisiana"], ["23", "Maine"],
  ["24", "Maryland"], ["25", "Massachusetts"], ["26", "Michigan"], ["27", "Minnesota"], ["28", "Mississippi"],
  ["29", "Missouri"], ["30", "Montana"], ["31", "Nebraska"], ["32", "Nevada"], ["33", "New Hampshire"],
  ["34", "New Jersey"], ["35", "New Mexico"], ["36", "New York"], ["37", "North Carolina"], ["38", "North Dakota"],
  ["39", "Ohio"], ["40", "Oklahoma"], ["41", "Oregon"], ["42", "Pennsylvania"], ["44", "Rhode Island"],
  ["45", "South Carolina"], ["46", "South Dakota"], ["47", "Tennessee"], ["48", "Texas"], ["49", "Utah"],
  ["50", "Vermont"], ["51", "Virginia"], ["53", "Washington"], ["54", "West Virginia"], ["55", "Wisconsin"],
  ["56", "Wyoming"]
]);

// Efficient data loading function
async function loadGlobalData() {
  if (!globalWasteData) {
    globalWasteData = await d3.csv('data/wastebyyear.csv', d => {
      d.year = +d.year;
      d.tons_waste = +d.tons_waste;
      return d;
    });
  }
  if (!globalTopoData) {
    const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
    globalTopoData = await d3.json(geoUrl);
  }
  return { wasteData: globalWasteData, topoData: globalTopoData };
}

// Global variable to track current view mode
let currentViewMode = 'per10k';

// Year slider event handler with performance improvements
const yearSlider = document.getElementById('year-slider');
const yearSliderValue = document.getElementById('year-slider-value');
const viewModeSelect = document.getElementById('view-mode');

if (yearSlider && yearSliderValue) {
  let debounceTimer = null;
  
  yearSlider.addEventListener('input', function() {
    const year = +this.value;
    yearSliderValue.textContent = year;
    
    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Increment operation ID to cancel previous operations
    currentOperationId++;
    const operationId = currentOperationId;
    
    // Debounce the actual drawing operations by 150ms
    debounceTimer = setTimeout(() => {
      // Check if this operation is still current
      if (operationId === currentOperationId) {
        // Redraw map and plots for selected year and state
        drawFoodWasteMap(year, operationId);
        drawFoodWasteBySubSectorBar({ year, state: selectedState || '', operationId });
        drawFoodWasteByFoodTypeBar({ year, state: selectedState || '', operationId });
      }
    }, 150);
  });
}

// Add view mode change handler
if (viewModeSelect) {
  viewModeSelect.addEventListener('change', function() {
    currentViewMode = this.value;
    const year = yearSlider ? +yearSlider.value : 2023;
    currentOperationId++;
    drawFoodWasteMap(year, currentOperationId);
  });
}

async function drawFoodWasteMap(year, operationId = null) {
  const { wasteData, topoData } = await loadGlobalData();
  
  // Check if operation was cancelled
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  const dataYear = wasteData.filter(d => d.year === year);

  // Aggregate tons_waste by state (per 10,000 people or total) using shared constant
  const wasteByState = d3.rollup(
    dataYear,
    v => {
      const state = v[0].state;
      const pop = STATE_POPULATION_2023[state];
      if (!pop) return null;
      const totalWaste = d3.sum(v, d => d.tons_waste);
      return {
        per10k: totalWaste / (pop / 10000),
        totalWaste: totalWaste
      };
    },
    d => d.state
  );

  // Check if operation was cancelled before DOM updates
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }

  // Map state names to postal codes for GeoJSON
  const width = 960, height = 500;
  d3.select('#map').selectAll('*').remove();
  const svg = d3.select('#map').append('svg')
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(topoData, topoData.objects.states));
  const path = d3.geoPath().projection(projection);

  // Compute color scale based on current view mode
  const values = Array.from(wasteByState.values(), d => currentViewMode === 'per10k' ? d.per10k : d.totalWaste);
  const color = d3.scaleSequential()
    .domain([d3.min(values), d3.max(values)])
    .interpolator(d3.interpolateYlOrRd);

  // Draw states
  const g = svg.append('g');
  const states = g
    .selectAll('path')
    .data(topojson.feature(topoData, topoData.objects.states).features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = STATE_ID_TO_NAME.get(fips);
      const waste = wasteByState.get(stateName);
      if (!waste) return '#eee';
      return color(currentViewMode === 'per10k' ? waste.per10k : waste.totalWaste);
    })
    .attr('stroke', '#000')
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = STATE_ID_TO_NAME.get(fips);
      // Set opacity: only hovered and selected state are fully opaque
      states.transition().duration(200)
        .style('opacity', s => {
          const sFips = s.id.toString().padStart(2, '0');
          const sName = STATE_ID_TO_NAME.get(sFips);
          return (s === d || sName === selectedState) ? 1 : 0.2;
        });
      
      const currentYear = yearSlider ? +yearSlider.value : year;
      drawFoodWasteBySubSectorBar({ year: currentYear, state: stateName });
      drawFoodWasteByFoodTypeBar({ year: currentYear, state: stateName });
        
      // Tooltip
      const waste = wasteByState.get(stateName);
      let html = `<strong>${stateName}</strong>`;
      if (waste) {
        if (currentViewMode === 'per10k') {
          html += `<br/><span class="red-number">${waste.per10k.toLocaleString(undefined, {maximumFractionDigits: 2})} tons</span> per 10,000 people`;
        } else {
          html += `<br/><span class="red-number">${waste.totalWaste.toLocaleString(undefined, {maximumFractionDigits: 2})} tons</span> total`;
        }
      } else {
        html += '<br/>No data available';
      }
      tooltip.style('display', 'block').html(html);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      if (selectedState) {
        states.style('opacity', s => {
          const sFips = s.id.toString().padStart(2, '0');
          const sName = STATE_ID_TO_NAME.get(sFips);
          return (sName === selectedState) ? 1 : 0.2;
        });
      } else {
        const currentYear = yearSlider ? +yearSlider.value : year;
        drawFoodWasteBySubSectorBar({ year: currentYear, state: '' });
        drawFoodWasteByFoodTypeBar({ year: currentYear, state: '' });
        states.transition().duration(200).style('opacity', 1);
      }
      tooltip.style('display', 'none');
    })
    .on('click', function(event, d) {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = STATE_ID_TO_NAME.get(fips);
      const currentYear = yearSlider ? +yearSlider.value : year;
      if (selectedState === stateName) {
        selectedState = null;
        drawFoodWasteBySubSectorBar({ year: currentYear, state: '' });
        drawFoodWasteByFoodTypeBar({ year: currentYear, state: '' });
        states.transition().duration(200).style('opacity', 1);
      } else {
        selectedState = stateName;
        // Highlight only the selected state
        states.transition().duration(200)
          .style('opacity', s => {
            const sFips = s.id.toString().padStart(2, '0');
            const sName = STATE_ID_TO_NAME.get(sFips);
            return (sName === selectedState) ? 1 : 0.2;
            });
          // Draw plots for selected state
          drawFoodWasteBySubSectorBar({ year: currentYear, state: selectedState });
          drawFoodWasteByFoodTypeBar({ year: currentYear, state: selectedState });
      }
    });

  if(selectedState) {
    states.style('opacity', s => {
      const sFips = s.id.toString().padStart(2, '0');
      const sName = STATE_ID_TO_NAME.get(sFips);
      return (sName === selectedState) ? 1 : 0.2;
    });
  }
  else {
    states.style('opacity', 1);
  }
  
  d3.select('#reset-map').on('click', function() {
    g.transition().duration(750).attr('transform', null);
    selectedState = null;
    yearSlider.value = 2023;
    yearSliderValue.textContent = 2023;
    const currentYear = yearSlider ? +yearSlider.value : year;
    drawFoodWasteBySubSectorBar({ year: currentYear, state: '' });
    drawFoodWasteByFoodTypeBar({ year: currentYear, state: '' });
    states.transition().duration(200).style('opacity', 1);
    // Note: Don't reset the year slider - keep the user's selected year
  });

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');

  // After drawing the map, render the legend
  // Remove any previous legend
  d3.select('#map-legend').selectAll('*').remove();
  // Create SVG for legend
  const legendWidth = 260, legendHeight = 18;
  const legendSvg = d3.select('#map-legend')
    .append('svg')
    .attr('width', legendWidth)
    .attr('height', legendHeight + 24);
  // Gradient
  const defs = legendSvg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'legend-gradient')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '100%').attr('y2', '0%');
  gradient.append('stop').attr('offset', '0%').attr('stop-color', color.range()[0]);
  gradient.append('stop').attr('offset', '100%').attr('stop-color', color.range()[1]);
  legendSvg.append('rect')
    .attr('x', 0)
    .attr('y', 8)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', 'url(#legend-gradient)');
  // Labels
  legendSvg.append('text')
    .attr('x', 0)
    .attr('y', legendHeight + 22)
    .attr('text-anchor', 'start')
    .attr('font-size', 12)
    .attr('fill', '#444')
    .text('Less');
  legendSvg.append('text')
    .attr('x', legendWidth)
    .attr('y', legendHeight + 22)
    .attr('text-anchor', 'end')
    .attr('font-size', 12)
    .attr('fill', '#444')
    .text('More');
  // Add view mode label
  legendSvg.append('text')
    .attr('x', legendWidth / 2)
    .attr('y', 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#444')
    .text(currentViewMode === 'per10k' ? 'Tons per 10,000 people' : 'Total tons');
}

function animateFoodWasteFalling(containerId, scale = 1, frequency = 400, preserveContent = false) {
  const container = d3.select(containerId);
  
  console.log(`animateFoodWasteFalling called - scale: ${scale}, preserveContent: ${preserveContent}`); // Debug log
  
  // Only clear content if we're not preserving it
  if (!preserveContent) {
    container.selectAll('*').remove();
    console.log('Cleared all content'); // Debug log
  } else {
    console.log('Preserving existing content'); // Debug log
  }
  
  // Use consistent base dimensions and fixed ground position
  const baseWidth = 400, baseHeight = 400;
  const width = baseWidth * scale, height = baseHeight * scale;
  
  // Fixed ground position (doesn't scale with container)
  const fixedGroundY = 350; // Fixed Y position for ground
  const fixedPileWidth = 160; // Fixed pile width
  const fixedPileHeight = 35; // Fixed pile height
  
  let svg = container.select('svg');
  
  // Create SVG if it doesn't exist
  if (svg.empty()) {
    console.log('Creating new SVG'); // Debug log
    svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);
      
    // Draw ground/pile base - use fixed position
    svg.append('ellipse')
      .attr('cx', width/2)
      .attr('cy', fixedGroundY)
      .attr('rx', fixedPileWidth * scale)
      .attr('ry', fixedPileHeight * scale)
      .attr('fill', '#b5a27a')
      .attr('class', 'trash-pile-base');
  } else {
    console.log('Updating existing SVG'); // Debug log
    // Update existing SVG size but keep pile at fixed position
    svg.attr('width', width).attr('height', height);
    
    // Update or create the pile base
    let pileBase = svg.select('.trash-pile-base');
    if (pileBase.empty()) {
      pileBase = svg.append('ellipse')
        .attr('class', 'trash-pile-base');
    }
    
    pileBase
      .attr('cx', width/2)
      .attr('cy', fixedGroundY) // Keep at fixed position
      .attr('rx', fixedPileWidth * scale)
      .attr('ry', fixedPileHeight * scale)
      .attr('fill', '#b5a27a');
      
    // Update existing circles - only scale their X positions and sizes, keep Y relative to fixed ground
    const existingCircles = svg.selectAll('.falling-circle');
    console.log(`Found ${existingCircles.size()} existing circles`); // Debug log
    
    existingCircles.each(function() {
      const currentTransform = d3.select(this).attr('transform');
      if (currentTransform) {
        const translate = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
        if (translate) {
          const x = parseFloat(translate[1]);
          const y = parseFloat(translate[2]);
          // Scale X position proportionally, but keep Y positions relative to fixed ground
          const newX = (x / baseWidth) * width;
          // Keep Y position the same (no scaling for vertical position)
          d3.select(this).attr('transform', `translate(${newX},${y})`);
        }
      }
    });
  }

  // Trash-like colors for circles
  const trashColors = [
    '#b5a27a', '#e0e0e0', '#7fd3e6', '#a3c586', '#f5e6c8', '#b0b0b0',
    '#fffbe6', '#ffe066', '#e74c3c', '#6a7b8c', '#e2b07a', '#e0f7fa'
  ];

  function dropCircle() {
    // Clean up old circles if there are too many (performance optimization)
    const existingCircles = svg.selectAll('.falling-circle');
    if (existingCircles.size() > 100) {
      existingCircles.filter((d, i) => i < 20).remove(); // Remove oldest 20 circles
    }
    
    // Determine how many circles to drop based on frequency (more intense = more circles)
    let numCircles = 1;
    if (frequency <= 50) {
      numCircles = 3; // Drop 3 circles for city section
    } else if (frequency <= 75) {
      numCircles = 2; // Drop 2 circles for very fast sections
    }
    
    // Drop multiple circles for more intensity
    for (let i = 0; i < numCircles; i++) {
      const x = width/2 + (Math.random()-0.5)*180*scale; // Scale spread
      const r = (8 + Math.random()*12) * scale; // Scale circle size
      const color = trashColors[Math.floor(Math.random()*trashColors.length)];
      const g = svg.append('g').attr('class', 'falling-circle');
      g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', r)
        .attr('fill', color)
        .attr('opacity', 0.95);
      g.attr('transform', `translate(${x},-30)`);
      
      // Land at fixed ground position with some randomness
      const landingY = fixedGroundY - 20 - Math.random()*15; // Much closer to ground (was -60 with -25 random)
      
      // Add slight delay between multiple drops for more natural effect
      const delay = i * 50; // 50ms delay between each circle in a batch
      
      setTimeout(() => {
        g.transition()
          .duration(scale > 1 ? 1200 : 1600 * (2 - scale*0.5)) // Faster for household (1200ms vs 1600ms)
          .ease(d3.easeBounce)
          .attr('transform', `translate(${x},${landingY})`)
          .on('end', function() {
            d3.select(this).style('opacity', 1);
          });
      }, delay);
    }
  }

  return setInterval(dropCircle, frequency);
}

// Function to handle layered scrolling text boxes
function initLayeredScrolling() {
  const scrollContainer = document.getElementById('scrolly-foodwaste');
  const textBoxes = document.querySelectorAll('.moving-text-box');
  
  function updateTextBoxPositions() {
    const scrollTop = window.pageYOffset;
    const containerTop = scrollContainer.offsetTop;
    const containerHeight = scrollContainer.offsetHeight;
    const containerBottom = containerTop + containerHeight;
    const progress = Math.max(0, Math.min(1, (scrollTop - containerTop) / (containerHeight * 0.8)));
    
    // Hide all text boxes if we're completely past the scrollytelling section
    if (scrollTop > containerBottom + 200) { // Added buffer to ensure they disappear
      textBoxes.forEach(box => {
        box.style.display = 'none';
      });
      return;
    } else {
      // Show text boxes when we're in or approaching the section
      textBoxes.forEach(box => {
        box.style.display = 'block';
      });
    }
    
    textBoxes.forEach((box, index) => {
      // Each text box appears at different scroll progress points
      const startProgress = index * 0.13; // Adjusted for 7 boxes: 0, 0.13, 0.26, 0.39, 0.52, 0.65, 0.78
      const endProgress = startProgress + 0.22; // Duration of visibility
      
      if (progress >= startProgress && progress <= endProgress) {
        // Box is active and moving through the viewport
        const boxProgress = (progress - startProgress) / (endProgress - startProgress);
        
        // Move from bottom of screen (100vh) to top of screen (-20vh)
        const topPosition = 100 - (boxProgress * 120); // vh units
        
        box.style.top = `${topPosition}vh`;
        box.style.opacity = 1;
        box.classList.add('active');
        
        // Update food visualization based on active text box
        if (boxProgress >= 0.25 && boxProgress <= 0.75) {
          if (index === 0) {
            updateFoodVisualization('day');
            updateTrashSummary('day');
            updateTrashAnimation('day');
          } else if (index === 1) {
            updateFoodVisualization('month');
            updateTrashSummary('month');
            updateTrashAnimation('month');
          } else if (index === 2) {
            updateFoodVisualization('year');
            updateTrashSummary('year');
            updateTrashAnimation('year');
          } else if (index === 3) {
            updateFoodVisualization('householdYear');
            updateTrashSummary('householdYear');
            updateTrashAnimation('householdYear');
          } else if (index === 4) {
            updateFoodVisualization('cityYear');
            updateTrashSummary('cityYear');
            updateTrashAnimation('cityYear');
          } else if (index === 5) {
            updateFoodVisualization('stateYear');
            updateTrashSummary('stateYear');
            updateTrashAnimation('stateYear');
          } else if (index === 6) {
            // Country section - transition away from food visualization
            // The country section will have its own separate visualization
            updateFoodVisualization('stateYear'); // Keep showing state for smooth transition
            updateTrashSummary('countryYear');
            updateTrashAnimation('stateYear');
          }
        }
        
        // Also update during the main visibility period to ensure sync
        if (boxProgress >= 0.15 && boxProgress <= 0.85) {
          if (index === 0 && currentFoodVisualization !== 'day') {
            updateFoodVisualization('day');
            updateTrashSummary('day');
            updateTrashAnimation('day');
          } else if (index === 1 && currentFoodVisualization !== 'month') {
            updateFoodVisualization('month');
            updateTrashSummary('month');
            updateTrashAnimation('month');
          } else if (index === 2 && currentFoodVisualization !== 'year') {
            updateFoodVisualization('year');
            updateTrashSummary('year');
            updateTrashAnimation('year');
          } else if (index === 3 && currentFoodVisualization !== 'householdYear') {
            updateFoodVisualization('householdYear');
            updateTrashSummary('householdYear');
            updateTrashAnimation('householdYear');
          } else if (index === 4 && currentFoodVisualization !== 'cityYear') {
            updateFoodVisualization('cityYear');
            updateTrashSummary('cityYear');
            updateTrashAnimation('cityYear');
          } else if (index === 5 && currentFoodVisualization !== 'stateYear') {
            updateFoodVisualization('stateYear');
            updateTrashSummary('stateYear');
            updateTrashAnimation('stateYear');
          } else if (index === 6) {
            // Country section handling
            updateTrashSummary('countryYear');
          }
        }
        
        // Fade effects at edges
        if (boxProgress < 0.1 || boxProgress > 0.9) {
          box.style.opacity = 0.4;
        }
      } else if (progress > endProgress) {
        // Box has passed through - position above screen and hide
        box.style.top = '-20vh';
        box.style.opacity = 0;
        box.classList.remove('active', 'passing');
      } else {
        // Box hasn't arrived yet - position below screen
        box.style.top = '100vh';
        box.style.opacity = 0;
        box.classList.remove('active', 'passing');
      }
    });
  }
  
  // Listen for scroll events with throttling for better performance
  let ticking = false;
  function handleScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateTextBoxPositions();
        ticking = false;
      });
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', handleScroll);
  
  // Initial position update
  updateTextBoxPositions();
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize sidebar menu
  initSidebarMenu();
  
  drawFoodWasteMap(2023);

  // --- Food waste scrollytelling calculations and visuals ---
  loadGlobalData().then(({ wasteData }) => {
    // Filter for 2023
    const data2023 = wasteData.filter(d => d.year === 2023);
    // Sum total waste and population using shared constant
    let totalTons = 0;
    let totalPop = 0;
    for (const state of Object.keys(STATE_POPULATION_2023)) {
      const stateWaste = data2023.filter(d => d.state === state);
      totalTons += d3.sum(stateWaste, d => d.tons_waste);
      totalPop += STATE_POPULATION_2023[state];
    }
    const totalLbs = totalTons * 2000;
    const perPersonYear = totalLbs / totalPop;
    const perPersonDay = perPersonYear / 365;
    const perPersonMonth = perPersonDay * 30;
    // Round for display
    const r = x => Math.round(x);
    
    // Calculate household amounts (average household size is 2.5 people)
    const householdSize = 2.5;
    const perHouseholdDay = perPersonDay * householdSize;
    const perHouseholdMonth = perPersonMonth * householdSize;
    const perHouseholdYear = perPersonYear * householdSize;
    
    // Calculate city amounts (average city size is 100,000 people)
    const citySize = 100000;
    const perCityYear = perPersonYear * citySize;
    
    // Calculate state amounts (average state size is 6.5 million people)
    const stateSize = 6500000;
    const perStateYear = perPersonYear * stateSize;
    
    // Calculate country amounts (entire USA population ~333 million people)
    const countrySize = 333000000;
    const perCountryYear = perPersonYear * countrySize;
    
    // Store values globally for content changes
    window.foodWasteData = {
      day: r(perPersonDay),
      month: r(perPersonMonth),
      year: r(perPersonYear),
      householdDay: r(perHouseholdDay),
      householdMonth: r(perHouseholdMonth),
      householdYear: r(perHouseholdYear),
      cityYear: Math.round(perCityYear / 1000000), // Convert to millions
      stateYear: Math.round(perStateYear / 1000000000), // Convert to billions
      countryYear: Math.round(perCountryYear / 1000000000) // Convert to billions
    };
    
    // Populate the text boxes with calculated values
    document.getElementById('day-number').textContent = window.foodWasteData.day;
    document.getElementById('month-number').textContent = window.foodWasteData.month;
    document.getElementById('year-number').textContent = window.foodWasteData.year;
    
    // Populate household text boxes - only year
    document.getElementById('household-year-number').textContent = window.foodWasteData.householdYear;
    
    // Populate city and state text boxes
    document.getElementById('city-year-number').textContent = window.foodWasteData.cityYear;
    document.getElementById('state-year-number').textContent = window.foodWasteData.stateYear;
    
    // Populate country text box
    document.getElementById('country-year-number').textContent = window.foodWasteData.countryYear;
    
    // Initialize both visualizations with day data
    currentFoodVisualization = null; // Reset to ensure updates work
    currentTrashSummary = null; // Reset to ensure updates work
    currentSection = null; // Reset section tracking
    updateFoodVisualization('day');
    updateTrashSummary('day');
    updateTrashAnimation('day'); // This will set up the initial animation
    
    // Initialize layered scrolling system
    initLayeredScrolling();
    
    // Initialize country section
    initCountrySection();
  });

  // Initialize causes, effects, and solutions visualizations
  initCausesEffectsSolutionsVisualizations();

  // Add this function to render the US-wide sub_sector bar chart with initial year
  const initialYear = yearSlider ? +yearSlider.value : 2023;
  drawFoodWasteBySubSectorBar({ year: initialYear, state: '' });
  drawFoodWasteByFoodTypeBar({ year: initialYear, state: '' });
});

// Global variable to track current food visualization and prevent rapid switching
let currentFoodVisualization = null;
let currentTrashSummary = null;
let isAnimating = false;
let currentTrashAnimation = null; // Track current animation interval
let currentSection = null; // Track current section (person vs household)
let selectedState = null;

// Function to update food visualization based on current step
function updateFoodVisualization(period) {
  // Don't switch if we're already showing this period or currently animating
  if (currentFoodVisualization === period || isAnimating) {
    return;
  }
  
  isAnimating = true;
  currentFoodVisualization = period;
  
  const container = document.getElementById('food-visualization-area');
  
  // Add fade-out animation before changing content
  container.style.opacity = '0.3';
  container.style.transform = 'scale(0.95)';
  
  // Wait for fade-out, then change content and fade-in
  setTimeout(() => {
    if (period === 'day') {
      // Day: Apples (0.33 lbs each)
      const appleWeight = 0.33;
      const numApples = Math.max(1, Math.round(window.foodWasteData.day / appleWeight));
      let applesSVG = '';
      const applesPerRow = 8; // More apples per row for larger space
      const appleRows = Math.ceil(numApples / applesPerRow);
      const appleGridWidth = applesPerRow * 25; // Increased spacing
      const appleSVGWidth = 450; // Much larger width
      const appleSVGHeight = 250; // Increased height
      const appleXOffset = (appleSVGWidth - appleGridWidth) / 2 + 12;
      const appleYStart = 40; // Better positioning
      
      for (let i = 0; i < numApples; i++) {
        const x = appleXOffset + (i % applesPerRow) * 25; // Increased spacing
        const y = appleYStart + Math.floor(i / applesPerRow) * 30; // Increased row spacing
        applesSVG += `<g><ellipse cx="${x}" cy="${y}" rx="11" ry="11" fill="#e74c3c" stroke="#b53c2e" stroke-width="2.5"/><rect x="${x-2.5}" y="${y-15}" width="5" height="10" fill="#8e5a1d"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${appleSVGWidth}" height="${appleSVGHeight}" style="display:block;margin:0 auto;">${applesSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numApples} apples (0.33 lbs each)</div>
      `;
    } else if (period === 'month') {
      // Month: Loaves of bread (1 lb each)
      const loafWeight = 1;
      const numLoaves = Math.max(1, Math.round(window.foodWasteData.month / loafWeight));
      let loavesSVG = '';
      const loavesPerCol = 6; // More per column for larger space
      const loavesCols = Math.ceil(numLoaves / loavesPerCol);
      const loafGridWidth = loavesCols * 35; // Increased spacing
      const loafSVGWidth = 450; // Much larger width
      const loafSVGHeight = 280; // Increased height
      const loafXOffset = (loafSVGWidth - loafGridWidth) / 2 + 17;
      const loafYStart = 40;
      
      for (let i = 0; i < numLoaves; i++) {
        const x = loafXOffset + Math.floor(i / loavesPerCol) * 35; // Increased spacing
        const y = loafYStart + (i % loavesPerCol) * 30; // Increased spacing
        loavesSVG += `<g><rect x="${x-12}" y="${y-10}" width="24" height="20" rx="7" fill="#e2b07a" stroke="#a67c52" stroke-width="2.5"/><ellipse cx="${x}" cy="${y-10}" rx="12" ry="7" fill="#fffbe6" opacity="0.7"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${loafSVGWidth}" height="${loafSVGHeight}" style="display:block;margin:0 auto;">${loavesSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numLoaves} loaves of bread (1 lb each)</div>
      `;
    } else if (period === 'year') {
      // Year: Watermelons (5 lbs each)
      const melonWeight = 5;
      const numMelons = Math.max(1, Math.round(window.foodWasteData.year / melonWeight));
      let melonsSVG = '';
      const melonsPerCol = 8; // More per column for larger space
      const melonsCols = Math.ceil(numMelons / melonsPerCol);
      const melonGridWidth = melonsCols * 40; // Increased spacing
      const melonSVGWidth = 480; // Much larger width
      const melonSVGHeight = 320; // Increased height
      const melonXOffset = (melonSVGWidth - melonGridWidth) / 2 + 20;
      const melonYStart = 40;
      
      for (let i = 0; i < numMelons; i++) {
        const x = melonXOffset + Math.floor(i / melonsPerCol) * 40; // Increased spacing
        const y = melonYStart + (i % melonsPerCol) * 32; // Increased spacing
        melonsSVG += `<g><ellipse cx="${x}" cy="${y}" rx="16" ry="16" fill="#a3c586" stroke="#4e7d3a" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="10" ry="10" fill="#fff" opacity="0.15"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${melonSVGWidth}" height="${melonSVGHeight}" style="display:block;margin:0 auto;">${melonsSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numMelons} watermelons (5 lbs each)</div>
      `;
    } else if (period === 'householdYear') {
      // Household Year: Grocery bags (15 lbs each)
      const bagWeight = 15;
      const numBags = Math.max(1, Math.round(window.foodWasteData.householdYear / bagWeight));
      let bagsSVG = '';
      const bagsPerCol = 6; // Increased to 6 to create more rows and reduce width
      const bagsCols = Math.ceil(numBags / bagsPerCol);
      const bagGridWidth = bagsCols * 42; // Reduced spacing further
      const bagSVGWidth = 580; // Keep same width
      const bagSVGHeight = 450; // Keep same height
      const bagXOffset = (bagSVGWidth - bagGridWidth) / 2 + 21; // Better centering
      const bagYStart = 60; // Reduced top margin slightly
      
      for (let i = 0; i < numBags; i++) {
        const x = bagXOffset + Math.floor(i / bagsPerCol) * 42; // Reduced spacing
        const y = bagYStart + (i % bagsPerCol) * 40; // Reduced vertical spacing
        // Grocery bag shape - even smaller size to fit better
        bagsSVG += `<g><rect x="${x-12}" y="${y-3}" width="24" height="18" rx="2.5" fill="#8b4513" stroke="#654321" stroke-width="1.2"/><rect x="${x-9}" y="${y-12}" width="18" height="10" fill="#deb887" stroke="#8b7355" stroke-width="1"/><line x1="${x-6}" y1="${y-9}" x2="${x+6}" y2="${y-9}" stroke="#4a4a4a" stroke-width="1.5" stroke-linecap="round"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${bagSVGWidth}" height="${bagSVGHeight}" style="display:block;margin:0 auto;">${bagsSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:15px;font-weight:500;">That's about ${numBags} full grocery bags (15 lbs each)</div>
      `;
    } else if (period === 'cityYear') {
      // City Year: Delivery trucks (2000 lbs each)
      const truckWeight = 2000;
      const numTrucks = Math.max(1, Math.round((window.foodWasteData.cityYear * 1000000) / truckWeight));
      let trucksSVG = '';
      const trucksPerCol = 8;
      const trucksCols = Math.ceil(numTrucks / trucksPerCol);
      const truckGridWidth = trucksCols * 35;
      const truckSVGWidth = 580;
      const truckSVGHeight = 450;
      const truckXOffset = (truckSVGWidth - truckGridWidth) / 2 + 17;
      const truckYStart = 50;
      
      for (let i = 0; i < numTrucks; i++) {
        const x = truckXOffset + Math.floor(i / trucksPerCol) * 35;
        const y = truckYStart + (i % trucksPerCol) * 35;
        // Delivery truck shape
        trucksSVG += `<g><rect x="${x-15}" y="${y-6}" width="30" height="12" rx="2" fill="#4a90e2" stroke="#2171b5" stroke-width="1.5"/><rect x="${x-12}" y="${y-10}" width="8" height="8" fill="#74a9f7" stroke="#2171b5" stroke-width="1"/><circle cx="${x-8}" cy="${y+8}" r="3" fill="#333"/><circle cx="${x+8}" cy="${y+8}" r="3" fill="#333"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${truckSVGWidth}" height="${truckSVGHeight}" style="display:block;margin:0 auto;">${trucksSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:15px;font-weight:500;">That's about ${numTrucks} delivery trucks full of food (2000 lbs each)</div>
      `;
    } else if (period === 'stateYear') {
      // State Year: Cargo ships (10 million lbs each - representing massive industrial scale)
      const shipWeight = 10000000; // 10 million lbs per cargo ship
      const numShips = Math.max(1, Math.round((window.foodWasteData.stateYear * 1000000000) / shipWeight));
      let shipsSVG = '';
      const shipsPerCol = 10; // More per column since we have fewer ships
      const shipsCols = Math.ceil(numShips / shipsPerCol);
      const shipGridWidth = shipsCols * 35; // Spacing for ships
      const shipSVGWidth = 580;
      const shipSVGHeight = 450;
      const shipXOffset = (shipSVGWidth - shipGridWidth) / 2 + 17;
      const shipYStart = 50;
      
      for (let i = 0; i < numShips; i++) {
        const x = shipXOffset + Math.floor(i / shipsPerCol) * 35;
        const y = shipYStart + (i % shipsPerCol) * 35;
        // Cargo ship shape - hull, superstructure, containers
        shipsSVG += `<g>
          <ellipse cx="${x}" cy="${y+5}" rx="16" ry="4" fill="#2c3e50" stroke="#1a252f" stroke-width="1"/>
          <rect x="${x-14}" y="${y-2}" width="28" height="7" rx="2" fill="#34495e" stroke="#2c3e50" stroke-width="1"/>
          <rect x="${x-10}" y="${y-8}" width="6" height="6" fill="#e74c3c" stroke="#c0392b" stroke-width="0.5"/>
          <rect x="${x-3}" y="${y-8}" width="6" height="6" fill="#3498db" stroke="#2980b9" stroke-width="0.5"/>
          <rect x="${x+4}" y="${y-8}" width="6" height="6" fill="#f39c12" stroke="#e67e22" stroke-width="0.5"/>
          <rect x="${x+8}" y="${y-5}" width="4" height="8" fill="#95a5a6" stroke="#7f8c8d" stroke-width="0.5"/>
        </g>`;
      }
      
      container.innerHTML = `
        <svg width="${shipSVGWidth}" height="${shipSVGHeight}" style="display:block;margin:0 auto;">${shipsSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:15px;font-weight:500;">That's about ${numShips} cargo ships full of food (10 million lbs each)</div>
      `;
    }
    
    // Fade-in animation after content change
    setTimeout(() => {
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
      
      // Reset animation flag after fade-in completes
      setTimeout(() => {
        isAnimating = false;
      }, 200);
    }, 50); // Small delay to ensure content is rendered
    
  }, 200); // Wait for fade-out animation
}

// Function to update the trash summary text
function updateTrashSummary(period) {
  // Don't update if we're already showing this period or currently animating
  if (currentTrashSummary === period) {
    return;
  }
  
  currentTrashSummary = period;
  
  const summaryElement = document.getElementById('trash-summary');
  const amountElement = document.getElementById('summary-amount');
  
  if (!window.foodWasteData) return;
  
  // Add fade-out animation
  summaryElement.style.opacity = '0.4';
  summaryElement.style.transform = 'scale(0.95)';
  
  setTimeout(() => {
    switch(period) {
      case 'day':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.day}</span> lb of food wasted per day`;
        break;
      case 'month':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.month}</span> lbs of food wasted per month`;
        break;
      case 'year':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.year}</span> lbs of food wasted per year`;
        break;
      case 'householdYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.householdYear}</span> lbs of food wasted per household per year`;
        break;
      case 'cityYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.cityYear}</span> million lbs of food wasted per city per year`;
        break;
      case 'stateYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.stateYear}</span> billion lbs of food wasted per state per year`;
        break;
      case 'countryYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.countryYear}</span> billion lbs of food wasted nationally per year`;
        break;
    }
    
    // Fade back in
    setTimeout(() => {
      summaryElement.style.opacity = '1';
      summaryElement.style.transform = 'scale(1)';
    }, 50);
  }, 150);
}

// Function to update the trash animation scale based on section
function updateTrashAnimation(period) {
  // Determine which section we're in
  let newSection = 'person'; // default
  if (period.includes('household')) {
    newSection = 'household';
  } else if (period.includes('city')) {
    newSection = 'city';
  } else if (period.includes('state')) {
    newSection = 'state';
  }
  
  // Only update if we're actually switching sections OR if no animation exists yet
  if (newSection !== currentSection || !currentTrashAnimation) {
    console.log(`Transitioning from ${currentSection} to ${newSection}`); // Debug log
    
    // Clear existing animation interval
    if (currentTrashAnimation) {
      clearInterval(currentTrashAnimation);
    }
    
    let scale = 1;
    let frequency = 400;
    let preserveContent = false;
    
    if (newSection === 'household') {
      scale = 1.3; // 30% larger for household
      frequency = 150; // Much faster drops (was 250ms, now 150ms)
      preserveContent = (currentSection === 'person'); // Preserve if transitioning from person
      console.log(`Household section - preserveContent: ${preserveContent}`); // Debug log
    } else if (newSection === 'city') {
      scale = 1.3; // Keep same scale as household to avoid cutting
      frequency = 50; // Much faster drops for more intensity
      preserveContent = (currentSection === 'person' || currentSection === 'household'); // Preserve from previous sections
      console.log(`City section - preserveContent: ${preserveContent}`); // Debug log
    } else if (newSection === 'state') {
      scale = 1.3; // Keep same scale as city to avoid cutting
      frequency = 40; // Extremely fast drops
      preserveContent = (currentSection === 'person' || currentSection === 'household' || currentSection === 'city'); // Preserve from previous sections
      console.log(`State section - preserveContent: ${preserveContent}`); // Debug log
    } else {
      scale = 1; // Normal size for person
      frequency = 400; // Normal frequency
      preserveContent = false; // Always start fresh for person section
      console.log(`Person section - starting fresh`); // Debug log
    }
    
    // Start new animation with updated parameters
    currentTrashAnimation = animateFoodWasteFalling('#fixed-trash-animation', scale, frequency, preserveContent);
    currentSection = newSection;
  }
  // If we're in the same section, do nothing - let the animation continue
}

// Country section food emoji filling functionality
function initCountrySection() {
  const countryHeadlineSection = document.getElementById('country-headline-section');
  const countrySection = document.getElementById('country-section');
  const countryVisual = document.getElementById('country-visual');
  const scaleLabels = document.getElementById('scale-labels');
  const headline = document.getElementById('country-headline');
  const subtext1 = document.getElementById('country-subtext-1');
  const subtext2 = document.getElementById('country-subtext-2');
  const countryHeader = document.querySelector('.country-header');
  
  // Food emojis to use
  const foodEmojis = ['🍎', '🍌', '🍞', '🥕', '🍅', '🥔', '🥬', '🍇', '🍊', '🥒', '🌽', '🥖', '🧄', '🫐', '🍑', '🥝', '🍐', '🥯', '🥨', '🧅'];
  
  // Create scale labels
  const maxValue = window.foodWasteData.countryYear;
  for (let i = 0; i <= 10; i++) {
    const value = Math.round((maxValue * i) / 10);
    const tick = document.createElement('div');
    tick.className = 'scale-tick';
    tick.textContent = `${value}B lbs`;
    scaleLabels.appendChild(tick);
  }
  
  // Generate grid of food emojis
  const rows = 50; // Reduced from 120 to 50 for better spacing and less density
  const cols = 35; // Reduced from 60 to 35 to leave more space for markers
  const totalEmojis = rows * cols;
  
  for (let i = 0; i < totalEmojis; i++) {
    const emoji = document.createElement('div');
    emoji.className = 'food-emoji';
    emoji.textContent = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
    
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    emoji.style.left = `${(col / (cols - 1)) * 85}%`; // Reduced from 96% to 85% to leave more space for markers
    emoji.style.top = `${(row / (rows - 1)) * 95}%`; // Reduced slightly for better vertical spacing
    
    countryVisual.appendChild(emoji);
  }
  
  // Scroll-based filling animation
  function updateCountryVisualization() {
    const headlineRect = countryHeadlineSection.getBoundingClientRect();
    const visualRect = countrySection.getBoundingClientRect();
    const transitionRect = document.getElementById('transition-section').getBoundingClientRect();
    const countryConclusion = document.getElementById('country-conclusion');
    const countryConclusionSection = document.getElementById('country-conclusion-section');
    const viewportHeight = window.innerHeight;
    
    // Handle headline section
    if (headlineRect.top <= viewportHeight && headlineRect.bottom >= 0) {
      const headlineProgress = Math.max(0, Math.min(1, (viewportHeight - headlineRect.top) / viewportHeight));
      
      // Sequential animation: headline first, then each subtext with delays
      if (headlineProgress > 0.2) {
        countryHeader.classList.add('animate');
      } else {
        countryHeader.classList.remove('animate');
      }
    }
    
    // Handle visualization section
    if (visualRect.top <= viewportHeight && visualRect.bottom >= 0) {
      const visualProgress = Math.max(0, Math.min(1, (viewportHeight - visualRect.top) / (viewportHeight + visualRect.height)));
      
      // Fill emojis from top to bottom
      const emojis = countryVisual.querySelectorAll('.food-emoji');
      const fillProgress = Math.max(0, Math.min(1, visualProgress / 0.8)); // Fill throughout the visualization scroll
      
      // Calculate how many rows to fill based on progress
      const rowsToFill = Math.floor(fillProgress * rows);
      const partialRowProgress = (fillProgress * rows) - rowsToFill;
      
      emojis.forEach((emoji, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        let shouldShow = false;
        
        if (row < rowsToFill) {
          // Show complete rows
          shouldShow = true;
        } else if (row === rowsToFill) {
          // Show partial row based on progress
          const colsToShow = Math.floor(partialRowProgress * cols);
          shouldShow = col < colsToShow;
        }
        
        if (shouldShow) {
          if (!emoji.classList.contains('visible')) {
            emoji.classList.add('visible', 'animate');
            setTimeout(() => emoji.classList.remove('animate'), 600);
          }
        } else {
          emoji.classList.remove('visible', 'animate');
        }
      });
    }
    
    // Handle country conclusion section
    if (countryConclusionSection) {
      const conclusionRect = countryConclusionSection.getBoundingClientRect();
      if (conclusionRect.top <= viewportHeight * 0.8 && conclusionRect.bottom >= 0) {
        countryConclusion.classList.add('visible');
      } else {
        countryConclusion.classList.remove('visible');
      }
    }
    
    // Handle transition section fade-in
    if (transitionRect.top <= viewportHeight && transitionRect.bottom >= 0) {
      const transitionProgress = Math.max(0, Math.min(1, (viewportHeight - transitionRect.top) / (viewportHeight + transitionRect.height)));
      const transitionHeader = document.getElementById('transition-header');
      const transitionText1 = document.getElementById('transition-text-1');
      const transitionText2 = document.getElementById('transition-text-2');
      const transitionArrowSection = document.getElementById('transition-arrow-section');
      
      // Header appears when 15% through the section
      if (transitionProgress > 0.15) {
        transitionHeader.classList.add('visible');
      } else {
        transitionHeader.classList.remove('visible');
      }
      
      // First text appears when 35% through the section
      if (transitionProgress > 0.35) {
        transitionText1.classList.add('visible');
      } else {
        transitionText1.classList.remove('visible');
      }
      
      // Second text and arrow appear together when 30% through the section (reduced from 60%)
      if (transitionProgress > 0.3) {
        transitionText2.classList.add('visible');
        transitionArrowSection.classList.add('visible');
      } else {
        transitionText2.classList.remove('visible');
        transitionArrowSection.classList.remove('visible');
      }
    }
  }
  
  // Throttled scroll listener
  let ticking = false;
  function handleCountryScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateCountryVisualization();
        ticking = false;
      });
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', handleCountryScroll);
  
  // Initial update
  updateCountryVisualization();
}
// Sidebar Menu Functionality
function initSidebarMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const closeMenu = document.getElementById('close-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuLinks = document.querySelectorAll('.sidebar-menu a[href^="#"]');

  // Open sidebar
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
    menuToggle.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  // Close sidebar
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    menuToggle.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }

  // Toggle sidebar
  menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Close sidebar when clicking close button
  closeMenu.addEventListener('click', closeSidebar);

  // Close sidebar when clicking overlay
  overlay.addEventListener('click', closeSidebar);

  // Handle menu link clicks
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        closeSidebar();
        
        // Smooth scroll to target section
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId) || document.querySelector(href);
        
        if (targetElement) {
          // Add some offset for the fixed header
          const headerHeight = document.querySelector('.newspaper-header').offsetHeight;
          const targetPosition = targetElement.offsetTop - headerHeight - 20;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      } else if (href && !href.startsWith('http') && !href.includes('://')) {
        // Handle relative page links (like about.html)
        closeSidebar();
        // Let the browser handle the navigation naturally
      } else {
        // External links - close sidebar but let browser handle
        closeSidebar();
      }
    });
  });

  // Close sidebar on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });
}

// Data visualization functions for causes, effects, and solutions section
function initCausesEffectsSolutionsVisualizations() {
  // Causes visualization - Pie chart showing distribution of food waste causes
  function createCausesChart() {
    const container = document.getElementById('waste-causes-chart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 40;

    const data = [
      { label: 'Consumer Level', value: 43 },
      { label: 'Date Label Confusion', value: 20 },
      { label: 'Large Portions', value: 15 },
      { label: 'Other', value: 22 }
    ];

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width/2},${height/2})`);

    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.label))
      .range(['#e74c3c', '#3498db', '#2ecc71', '#f1c40f']);

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius);

    const arcs = svg.selectAll('arc')
      .data(pie(data))
      .enter()
      .append('g');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.label))
      .attr('stroke', 'white')
      .style('stroke-width', '2px');

    // Add labels
    const labelArc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.6);

    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('dy', '.35em')
      .text(d => `${d.data.label} (${d.data.value}%)`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', 'white');
  }

  // Effects visualization - Bar chart showing environmental impacts
  function createEffectsChart() {
    const container = document.getElementById('waste-effects-chart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const data = [
      { impact: 'Greenhouse Gases', value: 8 },
      { impact: 'Water Waste', value: 21 },
      { impact: 'Land Use', value: 28 }
    ];

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const x = d3.scaleBand()
      .domain(data.map(d => d.impact))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value)])
      .range([height - margin.bottom, margin.top]);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(null, 's'));

    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.impact))
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - margin.bottom - y(d.value))
      .attr('fill', '#e74c3c');

    // Add value labels
    svg.selectAll('text.value')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value')
      .attr('x', d => x(d.impact) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 5)
      .attr('text-anchor', 'middle')
      .text(d => `${d.value}%`);
  }

  // Solutions visualization - Line chart showing impact of solutions over time
  function createSolutionsChart() {
    const container = document.getElementById('waste-solutions-chart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const data = [
      { month: 0, reduction: 0 },
      { month: 1, reduction: 10 },
      { month: 2, reduction: 20 },
      { month: 3, reduction: 30 }
    ];

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const x = d3.scaleLinear()
      .domain([0, 3])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 30])
      .range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x(d => x(d.month))
      .y(d => y(d.reduction));

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d => `Month ${d}`));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(null, 's'));

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2ecc71')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots
    svg.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.month))
      .attr('cy', d => y(d.reduction))
      .attr('r', 4)
      .attr('fill', '#2ecc71');
  }

  // Impact visualization - Stacked area chart showing cumulative impact
  function createImpactChart() {
    const container = document.getElementById('waste-impact-chart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const data = [
      { month: 0, environmental: 0, economic: 0, social: 0 },
      { month: 1, environmental: 10, economic: 5, social: 8 },
      { month: 2, environmental: 20, economic: 15, social: 18 },
      { month: 3, environmental: 30, economic: 25, social: 28 }
    ];

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const x = d3.scaleLinear()
      .domain([0, 3])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    const area = d3.area()
      .x(d => x(d.month))
      .y0(d => y(d.environmental))
      .y1(d => y(d.environmental + d.economic + d.social));

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d => `Month ${d}`));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(null, 's'));

    svg.append('path')
      .datum(data)
      .attr('fill', '#3498db')
      .attr('opacity', 0.6)
      .attr('d', area);
  }

  // Initialize all visualizations
  createCausesChart();
  createEffectsChart();
  createSolutionsChart();
  createImpactChart();

  // Add window resize handler
  window.addEventListener('resize', () => {
    d3.selectAll('#waste-causes-chart svg, #waste-effects-chart svg, #waste-solutions-chart svg, #waste-impact-chart svg').remove();
    createCausesChart();
    createEffectsChart();
    createSolutionsChart();
    createImpactChart();
  });
}

// top k sub-sectors/food types
const k = 5;

async function drawFoodWasteBySubSectorBar({ year = 2023, state = '', operationId = null } = {}) {
  const { wasteData } = await loadGlobalData();
  
  // Check if operation was cancelled after async operation
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Filter for year
  let filtered = wasteData.filter(d => d.year === +year);
  // Filter for state if provided
  if (state) filtered = filtered.filter(d => d.state === state);
  // Group by sub_sector, using sector if Not Applicable
  const grouped = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.tons_waste),
    d => d.sub_sector === 'Not Applicable' ? d.sector : d.sub_sector
  );
  grouped.sort((a, b) => b[1] - a[1]);
  const top5 = grouped.slice(0, k);
  
  // Check if operation was cancelled before DOM updates
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Set up SVG
  const container = d3.select('#d3-plot-top');
  container.selectAll('*').remove();
  const width = 360, height = 180, margin = {left: 120, right: 20, top: 28, bottom: 48};
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);
  // Y scale (categories)
  const y = d3.scaleBand()
    .domain(top5.map(d => d[0]))
    .range([margin.top, height - margin.bottom])
    .padding(0.15);
  // X scale (millions of tons)
  const x = d3.scaleLinear()
    .domain([0, d3.max(top5, d => d[1] / 1e6)])
    .nice()
    .range([margin.left, width - margin.right]);
  // Tooltip div (one global for this chart)
  let tooltip = d3.select('#d3-plot-top-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('id', 'd3-plot-top-tooltip')
      .attr('class', 'tooltip')
      .style('padding', '10px')
      .style('min-width', '0px')
      .style('position', 'absolute')
      .style('display', 'none');
  }
  // Bars
  const bars = svg.append('g')
    .selectAll('rect')
    .data(top5)
    .join('rect')
    .attr('x', x(0))
    .attr('y', d => y(d[0]))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('fill', '#e67e22')
    .on('mousemove', function(event, d) {
      tooltip
        .style('display', 'block')
        .html(`<strong>${d[0]}</strong><br><span class="red-number">${d3.format(',.2f')(d[1])} tons</span>`)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 24) + 'px');
      d3.select(this).attr('fill', '#b35413');
    })
    .on('mouseleave', function() {
      tooltip.style('display', 'none');
      d3.select(this).attr('fill', '#e67e22');
    });

  bars.transition()
    .duration(800)
    .attr('width', d => x(d[1] / 1e6) - x(0));

  // Y axis
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .selectAll('text')
    .style('font-size', '13px');
  // X axis (millions)
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(k).tickFormat(d => d3.format(',.1f')(d)))
    .selectAll('text')
    .style('font-size', '12px');
  // X axis label
  svg.append('text')
    .attr('x', (width + margin.left) / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .text('Millions of Tons');
  
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '15px')
    .attr('font-weight', 600)
    .text(`Top 5 Most Wasteful Sub-Sectors`);
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 3) // 20px below the previous line
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .attr('font-weight', 400)
    .text(state ? `(${state}, ${year})` : `(US, ${year})`);
}

async function drawFoodWasteByFoodTypeBar({ year = 2023, state = '', operationId = null } = {}) {
  const { wasteData } = await loadGlobalData();
  
  // Check if operation was cancelled after async operation
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Filter for year
  let filtered = wasteData.filter(d => d.year === +year);
  // Filter for state if provided
  if (state) filtered = filtered.filter(d => d.state === state);
  // Group by food_type
  const grouped = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.tons_waste),
    d => d.food_type
  );
  grouped.sort((a, b) => b[1] - a[1]);
  const top5 = grouped.slice(0, k);
  
  // Check if operation was cancelled before DOM updates
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Set up SVG
  const container = d3.select('#d3-plot-bottom');
  container.selectAll('*').remove();
  const width = 360, height = 180, margin = {left: 120, right: 20, top: 28, bottom: 48};
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);
  // Y scale (categories)
  const y = d3.scaleBand()
    .domain(top5.map(d => d[0]))
    .range([margin.top, height - margin.bottom])
    .padding(0.15);
  // X scale (millions of tons)
  const x = d3.scaleLinear()
    .domain([0, d3.max(top5, d => d[1] / 1e6)])
    .nice()
    .range([margin.left, width - margin.right]);
  // Tooltip div (one global for this chart)
  let tooltip = d3.select('#d3-plot-bottom-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('id', 'd3-plot-bottom-tooltip')
      .attr('class', 'tooltip')
      .style('padding', '10px')
      .style('min-width', '0px')
      .style('position', 'absolute')
      .style('display', 'none');
  }
  // Bars
  const bars = svg.append('g')
    .selectAll('rect')
    .data(top5)
    .join('rect')
    .attr('x', x(0))
    .attr('y', d => y(d[0]))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('fill', '#3498db')
    .on('mousemove', function(event, d) {
      tooltip
        .style('display', 'block')
        .html(`<strong>${d[0]}</strong><br><span class="red-number">${d3.format(',.2f')(d[1])} tons</span>`)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 24) + 'px');
      d3.select(this).attr('fill', '#1d5e8a');
    })
    .on('mouseleave', function() {
      tooltip.style('display', 'none');
      d3.select(this).attr('fill', '#3498db');
    });

    bars.transition()
      .duration(800)
      .attr('width', d => x(d[1] / 1e6) - x(0));

    // Y axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '13px');
    // X axis (millions)
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(k).tickFormat(d => d3.format(',.1f')(d)))
      .selectAll('text')
      .style('font-size', '12px');
    // X axis label
    svg.append('text')
      .attr('x', (width + margin.left) / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px')
      .text('Millions of Tons');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top - 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '15px')
      .attr('font-weight', 600)
      .text(`Top 5 Most Wasted Food Types`);
      svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 3) // 20px below the previous line
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .attr('font-weight', 400)
    .text(state ? `(${state}, ${year})` : `(US, ${year})`);
}

// Improved scroll-triggered background color transition
window.addEventListener('scroll', function() {
  const bgTransStart = document.getElementById('country-subtext-1');
  const bgTransEnd = document.getElementById('country-conclusion');
  if (!bgTransStart || !bgTransEnd) return;
  const start = bgTransStart.getBoundingClientRect();
  const end = bgTransEnd.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;

  // Calculate the scroll range for interpolation
  const startY = start.bottom + window.scrollY; // When the bottom of subtext1 leaves the top of viewport
  const endY = end.top + window.scrollY;      // When the top of map-container hits the top of viewport
  const scrollY = window.scrollY;

  // If before the range, keep white
  if (scrollY < startY) {
    document.body.style.transition = 'background 0.2s linear';
    document.body.style.background = '#fff';
    return;
  }
  // If after the range, keep blue
  if (scrollY > endY) {
    document.body.style.transition = 'background 0.2s linear';
    document.body.style.background = '#7e99d9';
    return;
  }
  // Interpolate color between white and #7e99d9
  let progress = (scrollY - startY) / (endY - startY);
  progress = Math.max(0, Math.min(1, progress));
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
  }
  const rgb1 = [255, 255, 255];
  const rgb2 = hexToRgb('7e99d9');
  const r = Math.round(lerp(rgb1[0], rgb2[0], progress));
  const g = Math.round(lerp(rgb1[1], rgb2[1], progress));
  const b = Math.round(lerp(rgb1[2], rgb2[2], progress));
  document.body.style.transition = 'background 0.2s linear';
  document.body.style.background = `rgb(${r},${g},${b})`;
});

// Performance improvement: operation cancellation system
let currentOperationId = 0;

