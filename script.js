// Initialize angular app
var foo = angular.module('fooApp', ['ngRoute', 'ngAnimate']);

foo.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/about', {
        templateUrl: 'partials/about.html',
        controller: 'mainController'
      }).
      when('/contact', {
        templateUrl: 'partials/contact.html',
        controller: 'mainController'
      }).
      when('/links', {
        templateUrl: 'partials/links.html',
        controller: 'mainController'
      }).
      otherwise({
        redirectTo: '/'
      });
  }]);

// Initialize main controller
foo.controller('mainController', ['$scope', '$location', function($scope, $location) {

  $scope.expand = function() {
    $scope.expanded = true;
  };

  switch ($location.path()) {
    case '/about':
    case '/contact':
    case '/links':
      $scope.expanded = true;
      break;
    default:
      $scope.expanded = false;
  }

  // Prevent html flickering (does not actually work)
  $scope.$watch('$viewContentLoaded', function(){
    body = d3.select('body').style("display", "block");
  });

}]);

// Initialize voronoi diagram
foo.controller('voronoiController', ['$scope', '$window', function($scope, $window) {

  // Counter for secret prize
  $scope.count = 0;

  var svg = d3.select("svg"),
      path = svg.selectAll("path"),
      width = $window.innerWidth,
      height = $window.innerHeight,
      frac = 3/4;
      n = 200;

  // Define width and height for firefox compatiblity
  svg.attr("width", width)
      .attr("height", height);

  var vertices = d3.range(n).map(function(d) {
    return [Math.random() * width, Math.random() * height];
  });

  var voronoi = d3.geom.voronoi().clipExtent([[0, 0], [width, height]]);

  // Generate voronoi object
  voronoi = voronoi(vertices);

  // Index vertices by distance from origin
  voronoi.sort(function(a,b) {
    a = a.point
    b = b.point
    return a[0] * a[0] / width + a[1] * a[1] / height - b[0] * b[0] / width - b[1] * b[1] / height;
  });

  // Prune unwanted paths
  voronoi = voronoi.filter(function(d, i) {
    // Update heuristic
    random = Boolean(Math.random() > 1 - 0.1 * i/n);
    flush = Boolean(i >= frac * n);
    return (random ? !flush : flush);
  });
  
  // Instantiate all paths by passing voronoi data into method
  path = path.data(voronoi, polygon);

  // Create DOM element and bind event listeners
  path.enter().append("path")
      .attr("d", polygon)
      .attr("opacity", 1)
      .on("mouseover", function() {
        d3.event.preventDefault();
        poly = d3.select(this).transition().duration(100);
        poly.attr("transform", "translate(-5,-5)");
        })
      .on("mouseout", function() {
        d3.event.preventDefault();
        poly = d3.select(this).transition().duration(100);
        poly.attr("transform", "translate(0,0)");
        })
      .on("mousedown", function() {
        d3.event.preventDefault();
        if (!this.hasAttribute('coloured')) {
          ++$scope.count;
          $scope.$apply(); // hacky angular thing
        }
        poly = d3.select(this).transition().duration(150);
        poly.style("fill", colour)
            .attr("transform", "translate(0,0)")
            .attr("coloured", "true");
        });

  // Svg path syntax generator
  function polygon(d) {
    return "M" + d.join("L") + "Z";
  }

  // Random colour generator
  function colour() {
    x = Math.floor(Math.random() * 3 + 1);
    switch(x) {
      case 1:
        return "#a4a4ff"
      case 2:
        return "#a4ffa4"
      case 3:
        return "#ffa4a4"
    }
  }

  // Dissipate function (in progress)
  function explode(coordinates) {
    polys = d3.selectAll("path")
      .on("mouseover", null)
      .on("mouseout", null)
      .on("mousedown", null)
      .transition()
      .duration(1300)
      .delay( function(d) {
        px = d.point[0]
        py = d.point[1]
        impulse = [px-coordinates[0], py-coordinates[1]]
        l = Math.sqrt(impulse[0] * impulse[0] + impulse[1] * impulse[1]);
        // Delay based on distance from mouse
        return Math.min(Math.round(l*l/500), 1/2*Math.round(l));
      })
      .ease('exp-out');
    polys.attr("transform", function(d) {
      px = d.point[0];
      py = d.point[1];
      impulse = [px-coordinates[0], py-coordinates[1]];
      theta = Math.atan(impulse[1]/impulse[0]);
      phi = theta * 360 / Math.PI / 2;

      l = Math.sqrt(impulse[0] * impulse[0] + impulse[1] * impulse[1]) / 80;
      l = Math.max(l, 2);

      // Force vector (heuristic)
      x = 10 * impulse[0] / (l*l);
      y = 10 * impulse[1] / (l*l);

      /*
      WORKFLOW: (SVD transform)
        rotate by -theta NOTE: d3 rotates counterclockwise in degrees, so -theta -> positive phi
        scale x by 1/length
        rotate by theta
      */

      return "rotate("+phi+","+px+","+py+")scale("+(1/l)+",1)translate("+((l-1)*px)+",0)rotate("+(-phi)+","+px+","+py+")translate("+x+","+y+")";
    })
      .transition()
      .duration(800)
      .ease('exp-in')
      .attr("transform", function(d) {
        px = d.point[0];
        py = d.point[1];
        impulse = [px-coordinates[0], py-coordinates[1]];
        x = -impulse[0];
        y = -impulse[1];
        return "translate("+x+","+y+")";
      })
      .attr("opacity", 0);
  }

  $scope.$watch("count", function (newValue, oldValue) {
      //tolerance = 5;
      tolerance = n * (1 - frac) * 3 / 4;
      if ( newValue == 1) {
        $scope.flash = svg.append("text")
            .attr("x", function() {
              return d3.mouse(this)[0]-10;
            })
            .attr("y", function(){
              return d3.mouse(this)[1]-5;
            })
            .attr("opacity", 1)
            .attr("text-anchor", "end")
            .text("Hint: colour them all!");
      } else if ( newValue == 2) {
        $scope.flash.transition()
            .attr("opacity", 0)
            .remove();
      } else if ( newValue >= tolerance ) {
        svg.on("mousedown", function() {
          if ( $scope.count >= tolerance ) {
            explode(d3.mouse(this));
            $scope.count = 0;
          }
        });
      }
  }, true);

}]);
