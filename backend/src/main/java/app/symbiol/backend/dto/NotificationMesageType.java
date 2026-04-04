package app.symbiol.backend.dto;

public enum NotificationMesageType {

    CONNECTED("connected"),
    IMAGE_UPLOADED("image_uploaded");


    private final String messageType;

    NotificationMesageType(String messageType) {
        this.messageType = messageType;
    }

    public String getType() { 
        return this.messageType;
    }

}
