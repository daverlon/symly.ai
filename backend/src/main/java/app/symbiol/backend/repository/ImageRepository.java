package app.symbiol.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import app.symbiol.backend.model.Image;

@Repository
public interface ImageRepository extends JpaRepository<Image, Long> {
    
    
}
