# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Install Maven (wrapper can be generated later: mvn -N wrapper:wrapper)
RUN apk add --no-cache maven

COPY pom.xml .
RUN mvn -B dependency:go-offline -DskipTests

COPY src src
RUN mvn -B -DskipTests package

# Run stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
