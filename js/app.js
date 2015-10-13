var app = {
	
	initialize: function(){
		this.getDroneData();
	},
	
	disableLoadingState: function(){
		$("#loader").hide();
	},
	
	getDroneData: function(){
		var _this = this;
		$.ajax({
		   type: 'GET',
		    url: 'http://api.dronestre.am/data/?callback=?',
		    jsonpCallback: 'jsonCallback',
		    contentType: "application/json",
		    dataType: 'jsonp',
		    success: function(json) {
				_this.renderMap(json.strike);
				_this.disableLoadingState();
				_this.bindUpdateMapAndChartOnResize();
		    },
		    error: function(e) {
		       console.log(e.message);
		    }
		});
	},
	
	bindUpdateMapAndChartOnResize: function(){
		$(window).on('resize', function(){
			app.map.resize();
			
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

		var color = d3.scale.ordinal()
		    .range(["#98abc5", "#8a89a6"]);	
		
	    var radius = this.calculateRadius(summary.total, this.totalDeaths);
		
		var arc = d3.svg.arc()
			    .outerRadius(radius)
			    .innerRadius(50);
		this.removePreviousPieChart();		

				
	     var svg = this.createChartElement(); 
				
		var pie = d3.layout.pie()
				  .value(function(d) { return d.count; })
				  .sort(null);
				
				var path = svg.selectAll('path')
				  .data(pie(dataset))
				  .enter()
				  .append('path')
				  .attr('d', arc)
				  .attr('fill', function(d, i) { 
				    return color(d.data.label);
				  });

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
		})								
	},	
	
	calculateRadius: function(currentTotal, eventualTotal){
		return 50 + (((this.getWidth() / 2) - 50)  * (currentTotal / eventualTotal));
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
	
	removePreviousPieChart: function(){
		d3.select("#chart").select("svg").remove();	
	},
	
	getSummary: function(data){
		var summary = {
			total: 0,
			civilians: 0,
			non_civilians: 0
		}
		_.each(data, function(strike){
			var civilians = 0;
			try {
				civilians_range = strike.civilians.split("-")
				if (civilians_range.length > 1){
					civilians = parseInt(civilians_range[0]);
				} else {
					civilians = parseInt(strike.civilians);
				}
			} catch (e){
				civilians = 0;
			}
			if (isNaN(civilians)){
				console.log(strike.civilians);
				civilians = 0;
			}							
			if (!isNaN(strike.radius) && strike.radius) {				
				summary.total = summary.total + strike.radius;
				summary.civilians = summary.civilians + civilians
				summary.non_civilians = summary.non_civilians + (strike.radius - civilians);
			}
		});
		return summary;
	},
	
	
	
	renderMap: function(data){
		var map = new Datamap({
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
		app.map = map;	
		this.totalDeaths = this.getTotalDeaths(data);
		app.stepThroughDates(app.prepareData(data));

		
	},
	
	prepareData: function(strikes){
		var mappedData = _.map(strikes, function(strike){
			if (!isNaN(strike.deaths_min)){
			var radius = parseInt(strike.deaths_min);
			return {
				name: strike.narrative,
				radius: radius,
				latitude: strike.lat,
				longitude: strike.lon,
				country: strike.country,
				date: strike.date,
				civilians: strike.civilians, 				
				fill: 'red'
			}
			}
		});
		return _.compact(mappedData);
	},
	
	stepThroughDates: function(data){
		var dates = this.getDates(data);
		var minDate = _.min(dates, function(date){ return date.format("X") });
		var maxDate = _.max(dates, function(date){ return date.format("X") });
		this.getNextDate(this.map, minDate, maxDate, data);
	},
	
	getNextDate: function(map, date, max, data){
		var theseDates = this.forDate(date, data);
		map.bubbles(theseDates, {
				borderColor: 'red',
			    popupTemplate: function (geo, strike) { 
			            return ['<div class="hoverinfo">' +  strike.name,
			            '<br/>Country: ' +  strike.country + '',
			            '<br/>Date: ' +  strike.date + '',
			            '</div>'].join('');
					}
				});
		this.renderPieChart(theseDates);		
		if (date.format("X") < max.format("X")){
			var tomorrow = date.add(1,'months');
			setTimeout(function(){
				app.getNextDate(map,tomorrow,max, data)
				}, 300);
		}
	},
	
	
	forDate: function(endDate, data){
		var unixEndDate = endDate.format("X");
		return _.filter(data, function(strike){ 
			return moment(strike.date).format("X") < unixEndDate 
		});
	},
	
	getDates: function(data){
		return _.chain(data).pluck("date").uniq().map(function(date){
			return moment(date);
		}).value();
	},
	
	getTotalDeaths: function(data){
		return _.reduce(data,function(total,strike){
			if (!isNaN(strike.deaths_min) && strike.deaths_min){
				return total + (parseInt(strike.deaths_min) );
			} else {
				return total
			}
		}, 0);
	}
	
};

$(document).ready(function(){
	app.initialize();
})