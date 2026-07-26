package com.picore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PicoreApplication {
    public static void main(String[] args) {
        SpringApplication.run(PicoreApplication.class, args);
    }
}
