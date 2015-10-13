var app = {
	
	initialize: function(){
		this.getDroneData();
	},
	
	disableLoadingState: function(){
		$("#loader").hide();
	},
	
	getDroneData: function(){
		$.ajax({
		   type: 'GET',
		    url: 'http://api.dronestre.am/data/?callback=?',
		    jsonpCallback: 'jsonCallback',
		    contentType: "application/json",
		    dataType: 'jsonp',
		    success: function(json) {
				app.initializeCharts(app.prepareData(json.strike))
		    },
		    error: function(e) {
		       console.log(e.message);
		    }
		});
	},
	
	initializeCharts: function(data){
		this.totalDeaths = this.getTotalDeaths(data);
		this.renderMap(data);
		this.initializeSlider(data);
		this.disableLoadingState();
		this.bindUpdateMapAndChartOnResize();		
	},
		
	getMinDate: function(data){		
		this.minDate = this.minDate || _.min(this.getDates(data), function(date){ return date.format("X") });
		return this.minDate;
	},
	
	getMaxDate: function(data){
	   this.maxDate = this.maxDate || _.max(this.getDates(data), function(date){ return date.format("X") });	
	   return this.maxDate
	},
	
	initializeSlider: function(data){		
		var minDate = this.getMinDate(data).format("YYYY");
		var maxDate = this.getMaxDate(data).format("YYYY");
		d3.select('#slider').call(d3.slider(maxDate).on("slide", function(evt, value) {
			app.updateFromSliderValue(value, data);
		}).axis(true).min(minDate).max(maxDate));
		app.updateFromSliderValue(minDate, data);
	},
	
	updateFromSliderValue: function(value, data){
		var year = Math.floor(value);
		var months = Math.floor((value - year) * 12) + 1;
		var newDate = moment(months + "-" + year, "MM-YYYY");
		this.latest_strikes = this.forDate(newDate, data);
		this.latest_date = newDate;
		this.renderAll(this.latest_strikes, this.latest_date);
	},
	
	bindUpdateMapAndChartOnResize: function(){
		$(window).on('resize', function(){
			app.renderAll(app.latest_strikes, app.latest_date);
		})
	},
	
	getWidth: function(){
		return d3.select("#chart").node().getBoundingClientRect().width;
	},
	
	getHeight: function(){
		return this.getWidth();
	},
	
	renderPieChart: function(data){		
		var summary = this.getSummary(data);		
		var dataset = [{label: 'civilians', count: summary.civilians}, {label: 'non-civilians', count: summary.non_civilians}];
		this.removePreviousPieChart();		
		var svg = this.createChartElement(); 
		if (summary.total > 0){
			var arc = this.renderArc(summary)						
			var pie = this.createPieLayout();
			var path = this.createPath(svg,arc,pie,dataset)
		}						
		this.renderLabels(summary);	
	},	
	
	getSummary: function(data){
		return _.reduce(data, function(summary,strike){							
			return strike.min_deaths ? app.updateSummary(summary, strike) : summary;
		}, {total:0, civilians:0, non_civilians: 0});
	},	
	
	updateSummary: function(summary, strike){
		return {
			total : summary.total + strike.min_deaths,
			civilians : summary.civilians + strike.min_civilians,
			non_civilians : summary.non_civilians + (strike.min_deaths - strike.min_civilians)
		}
	},
	
	renderArc: function(summary){
		var radius = this.calculateRadius(summary.total, this.totalDeaths);		
		return d3.svg.arc()
			    .outerRadius(radius)
			    .innerRadius(50);
	},
	
	createChartElement: function(){
		return d3.select('#chart')				  
		          .append('svg')
		          .attr('width', this.getWidth())
		          .attr('height', this.getHeight())
		          .append('g')
		          .attr('transform', 'translate(' + (this.getWidth() / 2) + 
		            ',' + (this.getHeight() / 2) + ')');
	},
	
	createPieLayout: function(){
		return d3.layout.pie()
				  .value(function(d) { return d.count; })
				  .sort(null);
	},
	
	createPath: function(svg,arc,pie,dataset){
		var colors = this.getColors();
		return svg.selectAll('path')
		  .data(pie(dataset))
		  .enter()
		  .append('path')
		  .attr('d', arc)
		  .attr('fill', function(d, i) { 
		    return colors(d.data.label);
		  });
	},
	
	getColors: function(){
		return d3.scale.ordinal().range(["#98abc5", "#8a89a6"]);
	},
	
	renderLabels: function(summary){
		d3.select('#chart svg').append("text")
			.attr("x", this.getWidth() / 2)
			.attr("y", (this.getHeight() / 2) - 8)
			.attr("text-anchor", "middle")
			.attr("dy", "0.4em").text(function(){
				return "Civilians: " + summary.civilians;
			})
		d3.select('#chart svg').append("text")
		  	.attr("x", this.getWidth() / 2)
		    .attr("y", (this.getHeight() / 2) + 8)
		  	.attr("text-anchor", "middle")
		    .attr("dy", "0.4em").text(function(){
				return "Total: " + Math.floor(summary.total);
			});
	},
	
	calculateRadius: function(currentTotal, eventualTotal){
		return 50 + (((this.getWidth() / 2) - 50)  * (currentTotal / eventualTotal));
	},	
	
	removePreviousPieChart: function(){
		d3.select("#chart").select("svg").remove();	
	},	
	
	renderMap: function(data){
		this.map = new Datamap({
		        scope: 'world',
		        element: document.getElementById('main'),
				setProjection: function(element) {
				    var projection = d3.geo.equirectangular()
				      .center([65, 15])
				      .rotate([4.4, 0])
				      .scale(app.getWidth())
				      .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
				    var path = d3.geo.path()
				      .projection(projection);
				    return {path: path, projection: projection};
				  },
		        height: this.getHeight(),
		 
		});		
		//app.stepThroughDates(data);		
	},
	
	prepareData: function(strikes){		
		var mappedData = _.map(strikes, function(strike){
			var date = moment(strike.date);
			var min_deaths = app.parseMinDeaths(strike)
			return {
				name: strike.narrative,
				min_deaths: min_deaths,
				radius: min_deaths,
				latitude: strike.lat,
				longitude: strike.lon,
				country: strike.country,
				min_civilians: app.parseCivilians(strike),
				date: date,
				unixDate: date.format("X"),				 				
				fill: 'red'
			}
		});
		return _.compact(mappedData);
	},
	
	stepThroughDates: function(data){
		this.getNextDate(this.getMinDate(), this.getMaxDate(), data);
	},
	
	getNextDate: function(date, max, data){
		this.latest_strikes = this.forDate(date, data);
		this.latest_date = date;
		this.renderAll(this.latest_strikes, this.latest_date);
		if (date.format("X") < max.format("X")){
			var tomorrow = date.add(1,'months');
			setTimeout(function(){
				app.getNextDate(tomorrow,max, data)
				}, 300);
		}
	},
	
	renderAll: function(strikes, date){
		this.renderBubbles(strikes);
		this.renderPieChart(strikes);		
		this.updateDateLabel(date);
	},
	
	renderBubbles: function(strikes){
		this.map.bubbles(strikes, {
				borderColor: 'red',
			    popupTemplate: function (geo, strike) { 
			            return ['<div class="hoverinfo">' +  strike.name,
			            '<br/>Country: ' +  strike.country + '',
			            '<br/>Date: ' +  strike.date.format("MM/DD/YY") + '',
			            '</div>'].join('');
					}
				});
	},
	
	parseCivilians: function(strike){
		var civilians = 0;
		civilians_range = strike.civilians.split("-")		
		if (civilians_range.length > 1){
			civilians = parseInt(civilians_range[0]);
		} else {
			civilians = parseInt(strike.civilians);
		}
		if (isNaN(civilians)){
			civilians = 0;
		}
		return civilians;
	},
	
	parseMinDeaths: function(strike){
		var min_deaths = parseInt(strike.deaths_min);
		if (isNaN(strike.deaths_min)){
			min_deaths = 0;
		}
		return min_deaths;
	},
	
	updateDateLabel: function(date){
		$("#date-label").html("Drone Strike Casualties As Of " + date.format("MM/YYYY"))
	},
	
	
	forDate: function(endDate, data){
		var unixEndDate = endDate.format("X");
		return _.filter(data, function(strike){ 
			return strike.unixDate < unixEndDate 
		});
	},
	
	getDates: function(data){
		this.dates = this.dates || _.chain(data).pluck("date").uniq().value();
		return this.dates;
	},
	
	getTotalDeaths: function(data){
		return _.reduce(data,function(total,strike){
			return (strike.deaths_min) ? total + strike.deaths_min : total;
		}, 0);
	}
	
};

$(document).ready(function(){
	app.initialize();
})