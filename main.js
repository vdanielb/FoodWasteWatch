async function drawFoodWasteMap2023() {
  // Load US states GeoJSON
  const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
  const us = await d3.json(geoUrl);

  // Load CSV and filter for 2023
  const data = await d3.csv('data/wastebyyear.csv', d => {
  // const data = await d3.csv('https://raw.githubusercontent.com/vdanielb/FoodWasteWatch/main/data/wastebyyear.csv', d => {
    d.year = +d.year;
    d.tons_waste = +d.tons_waste;
    return d;
  });
  const data2023 = data.filter(d => d.year === 2023);

  // 2023 US Census state population estimates (July 1, 2023)
  const statePop2023 = {
    "Alabama": 5074296,
    "Alaska": 733406,
    "Arizona": 7359191,
    "Arkansas": 3045637,
    "California": 38918045,
    "Colorado": 5912064,
    "Connecticut": 3605944,
    "Delaware": 1045631,
    "District of Columbia": 678972,
    "Florida": 22377446,
    "Georgia": 11015963,
    "Hawaii": 1427539,
    "Idaho": 1942571,
    "Illinois": 12582032,
    "Indiana": 6842384,
    "Iowa": 3205690,
    "Kansas": 2934582,
    "Kentucky": 4546607,
    "Louisiana": 4569031,
    "Maine": 1396966,
    "Maryland": 6195295,
    "Massachusetts": 6981974,
    "Michigan": 10061863,
    "Minnesota": 5737914,
    "Mississippi": 2918320,
    "Missouri": 6168187,
    "Montana": 1103349,
    "Nebraska": 1961504,
    "Nevada": 3235251,
    "New Hampshire": 1388992,
    "New Jersey": 9261692,
    "New Mexico": 2115252,
    "New York": 19453561,
    "North Carolina": 10701022,
    "North Dakota": 779261,
    "Ohio": 11780017,
    "Oklahoma": 4019800,
    "Oregon": 4237256,
    "Pennsylvania": 12801989,
    "Rhode Island": 1097379,
    "South Carolina": 5321610,
    "South Dakota": 909824,
    "Tennessee": 7092654,
    "Texas": 30439188,
    "Utah": 3402027,
    "Vermont": 647156,
    "Virginia": 8683619,
    "Washington": 7715946,
    "West Virginia": 1778070,
    "Wisconsin": 5893718,
    "Wyoming": 586485
  };

  // Aggregate tons_waste by state (per 10,000 people)
  const wasteByState = d3.rollup(
    data2023,
    v => {
      const state = v[0].state;
      const pop = statePop2023[state];
      if (!pop) return null;
      const totalWaste = d3.sum(v, d => d.tons_waste);
      return totalWaste / (pop / 10000); // tons per 10,000 people
    },
    d => d.state
  );

  // Map state names to postal codes for GeoJSON
  // us-atlas uses state FIPS codes, so we need a mapping
  // We'll use d3.geoPath and d3.geoAlbersUsa for projection
  const width = 960, height = 500;
  d3.select('#map').selectAll('*').remove();
  const svg = d3.select('#map').append('svg')
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(us, us.objects.states));
  const path = d3.geoPath().projection(projection);

  // Get FIPS to state name mapping
  const stateIdToName = new Map([
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

  // Compute color scale
  const values = Array.from(wasteByState.values());
  const color = d3.scaleSequential()
    .domain([d3.min(values), d3.max(values)])
    .interpolator(d3.interpolateYlOrRd);

  // Draw states
  const g = svg.append('g');
  const states = g
    .selectAll('path')
    .data(topojson.feature(us, us.objects.states).features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = stateIdToName.get(fips);
      const waste = wasteByState.get(stateName);
      return waste ? color(waste) : '#eee';
    })
    .attr('stroke', '#000')
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = stateIdToName.get(fips);
      const waste = wasteByState.get(stateName);
      tooltip.style('display', 'block')
        .html(`<strong>${stateName}</strong><br/>${waste ? waste.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'No data'} tons per 10,000 people`);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      tooltip.style('display', 'none');
    })
    .on('click', function(event, d) {
      const isZoomed = d3.select(this).classed('zoomed');
      if (isZoomed) {
        g.transition().duration(750).attr('transform', null);
        states.transition().duration(750).style('opacity', 1).classed('zoomed', false);
      } else {
        const [[x0, y0], [x1, y1]] = path.bounds(d);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const x = (x0 + x1) / 2;
        const y = (y0 + y1) / 2;
        const scale = Math.max(1, Math.min(8, 0.8 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];
        g.transition().duration(750)
          .attr('transform', `translate(${translate[0]},${translate[1]}) scale(${scale})`);
        states.transition().duration(750)
          .style('opacity', s => (s === d ? 1 : 0.2))
          .classed('zoomed', s => s === d);
      }
    });

  // Add reset view button functionality
  d3.select('#resetView').on('click', function() {
    g.transition().duration(750).attr('transform', null);
    states.transition().duration(750).style('opacity', 1).classed('zoomed', false);
  });

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');
}

drawFoodWasteMap2023();
