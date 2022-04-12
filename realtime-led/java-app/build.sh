# Run './build.sh' when you want to compile and run the Java Application
# Run './build.sh release' when you want to compile and package to a release jar
if [ "$1" = "release" ]; then
    mvn clean compile package
else
    mvn clean compile exec:java
fi
