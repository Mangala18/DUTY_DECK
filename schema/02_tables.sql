-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: localhost    Database: clockin_mysql
-- ------------------------------------------------------
-- Server version	8.0.43-0ubuntu0.24.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `businesses`
--

DROP TABLE IF EXISTS `businesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `businesses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `business_code` varchar(100) NOT NULL,
  `business_name` varchar(100) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `business_code` (`business_code`),
  KEY `idx_business_code` (`business_code`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pay_rates`
--

DROP TABLE IF EXISTS `pay_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pay_rates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_code` varchar(25) NOT NULL,
  `default_hours` decimal(5,2) DEFAULT '38.00',
  `weekday_rate` decimal(10,2) DEFAULT '0.00',
  `saturday_rate` decimal(10,2) DEFAULT '0.00',
  `sunday_rate` decimal(10,2) DEFAULT '0.00',
  `public_holiday_rate` decimal(10,2) DEFAULT '0.00',
  `overtime_rate` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rate_staff_code` (`staff_code`),
  KEY `idx_pay_staff` (`staff_code`),
  CONSTRAINT `pay_rates_ibfk_1` FOREIGN KEY (`staff_code`) REFERENCES `staff` (`staff_code`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rosters`
--

DROP TABLE IF EXISTS `rosters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rosters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `venue_code` varchar(100) NOT NULL,
  `staff_code` varchar(25) NOT NULL,
  `shift_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_roster` (`venue_code`,`staff_code`,`shift_date`,`start_time`),
  KEY `idx_roster_date_venue` (`shift_date`,`venue_code`),
  KEY `idx_roster_staff_date` (`staff_code`,`shift_date`),
  CONSTRAINT `rosters_ibfk_1` FOREIGN KEY (`venue_code`) REFERENCES `venues` (`venue_code`) ON DELETE CASCADE,
  CONSTRAINT `rosters_ibfk_2` FOREIGN KEY (`staff_code`) REFERENCES `staff` (`staff_code`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roster_id` int DEFAULT NULL,
  `staff_code` varchar(25) NOT NULL,
  `venue_code` varchar(100) NOT NULL,
  `clock_in` timestamp NOT NULL,
  `clock_out` timestamp NULL DEFAULT NULL,
  `shift_state` enum('NONE','ACTIVE','ON_BREAK','COMPLETED') DEFAULT 'NONE',
  `approval_status` enum('PENDING','APPROVED','DISCARDED') NOT NULL DEFAULT 'PENDING',
  `payday_type` enum('WEEKDAY','SATURDAY','SUNDAY','PUBLIC_HOLIDAY') NOT NULL DEFAULT 'WEEKDAY',
  `last_action_time` timestamp NULL DEFAULT NULL,
  `break_minutes` int DEFAULT '0',
  `hours_worked` decimal(6,2) DEFAULT NULL,
  `applied_rate` decimal(10,2) DEFAULT NULL,
  `total_pay` decimal(12,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `venue_code` (`venue_code`),
  KEY `roster_id` (`roster_id`),
  KEY `idx_shift_staff_code` (`staff_code`),
  KEY `idx_shift_staff_clockin` (`staff_code`,`clock_in`),
  KEY `idx_shift_date` (`clock_in`,`clock_out`),
  KEY `idx_shifts_payroll` (`staff_code`,`clock_in`,`clock_out`),
  KEY `idx_shift_state` (`shift_state`),
  KEY `idx_staff_shift_state` (`staff_code`,`shift_state`),
  KEY `idx_shifts_staff_state` (`staff_code`,`shift_state`),
  CONSTRAINT `shifts_ibfk_1` FOREIGN KEY (`staff_code`) REFERENCES `staff` (`staff_code`) ON DELETE CASCADE,
  CONSTRAINT `shifts_ibfk_2` FOREIGN KEY (`venue_code`) REFERENCES `venues` (`venue_code`) ON DELETE CASCADE,
  CONSTRAINT `shifts_ibfk_3` FOREIGN KEY (`roster_id`) REFERENCES `rosters` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_code` varchar(25) NOT NULL,
  `business_code` varchar(100) NOT NULL,
  `venue_code` varchar(100) DEFAULT NULL,
  `first_name` varchar(50) NOT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) NOT NULL,
  `phone_number` varchar(30) DEFAULT NULL,
  `employment_status` enum('active','inactive','terminated') DEFAULT 'active',
  `employment_type` enum('full_time','part_time','casual','contract') DEFAULT 'full_time',
  `role_title` varchar(50) DEFAULT NULL,
  `staff_type` enum('venue_staff','system_admin') DEFAULT 'venue_staff',
  `start_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_code` (`staff_code`),
  KEY `idx_staff_code` (`staff_code`),
  KEY `idx_staff_business_code` (`business_code`),
  KEY `idx_staff_venue_code` (`venue_code`),
  KEY `idx_staff_type_business` (`staff_type`,`business_code`),
  CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`business_code`) REFERENCES `businesses` (`business_code`) ON DELETE CASCADE,
  CONSTRAINT `staff_ibfk_2` FOREIGN KEY (`venue_code`) REFERENCES `venues` (`venue_code`) ON DELETE CASCADE,
  CONSTRAINT `chk_staff_type_scope` CHECK ((((`staff_type` = _utf8mb4'system_admin') and (`venue_code` is null)) or ((`staff_type` = _utf8mb4'venue_staff') and (`venue_code` is not null))))
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `staff_compliance`
--

DROP TABLE IF EXISTS `staff_compliance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_compliance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `staff_code` varchar(25) NOT NULL,
  `tfn` varchar(20) DEFAULT NULL,
  `super_fund` varchar(100) DEFAULT NULL,
  `super_member_id` varchar(50) DEFAULT NULL,
  `payroll_ref` varchar(50) DEFAULT NULL,
  `account_holder_name` varchar(100) DEFAULT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
  `bank_bsb` varchar(20) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_compliance_staff_code` (`staff_code`),
  CONSTRAINT `staff_compliance_ibfk_1` FOREIGN KEY (`staff_code`) REFERENCES `staff` (`staff_code`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sync_log`
--

DROP TABLE IF EXISTS `sync_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sync_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `offline_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID from frontend queue for idempotency',
  `staff_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Staff who performed the action',
  `type` enum('clockin','clockout','breakin','breakout') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of action',
  `timestamp` timestamp NOT NULL COMMENT 'When the action occurred (UTC)',
  `status` enum('synced','duplicate','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'synced' COMMENT 'Sync result status',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT 'Error details if status = failed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When record was created on server',
  PRIMARY KEY (`id`),
  UNIQUE KEY `offline_id` (`offline_id`),
  KEY `idx_offline_id` (`offline_id`),
  KEY `idx_staff_code` (`staff_code`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log for offline kiosk event synchronization';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staff_code` varchar(25) DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `access_level` enum('system_admin','manager','supervisor','employee') NOT NULL,
  `kiosk_pin` char(6) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`email`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_user_staff_code` (`staff_code`),
  CONSTRAINT `users_ibfk_3` FOREIGN KEY (`staff_code`) REFERENCES `staff` (`staff_code`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `venues`
--

DROP TABLE IF EXISTS `venues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `venue_code` varchar(100) NOT NULL,
  `business_code` varchar(100) NOT NULL,
  `venue_name` varchar(150) DEFAULT NULL COMMENT 'Fixed typo: venu_name → venue_name',
  `contact_email` varchar(100) NOT NULL,
  `kiosk_password` varchar(255) NOT NULL,
  `state` varchar(50) DEFAULT NULL,
  `venue_address` varchar(150) DEFAULT NULL,
  `timezone` varchar(150) DEFAULT NULL,
  `week_start` enum('Mon','Tue','Wed','Thu','Fri','Sat','Sun') DEFAULT 'Mon',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `venue_code` (`venue_code`),
  UNIQUE KEY `contact_email` (`contact_email`),
  KEY `idx_venue_code` (`venue_code`),
  KEY `idx_venue_business_code` (`business_code`),
  CONSTRAINT `venues_ibfk_1` FOREIGN KEY (`business_code`) REFERENCES `businesses` (`business_code`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-11 16:16:56
